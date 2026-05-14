/**
 * Extract a stable repo key from Cursor Admin `/teams/filtered-usage-events` rows.
 * Payload shapes vary; we prefer `owner/repo` when derivable from GitHub URLs.
 */

const FLAT_STRING_KEYS = [
  'repo',
  'repository',
  'repoName',
  'repositoryName',
  'gitRepo',
  'remoteUrl',
  'workspaceRepo',
  'repositoryUrl',
  'gitRemoteUrl',
  'cloneUrl',
  'fullName',
  'full_name',
] as const;

const NEST_OBJECT_KEYS = ['metadata', 'context', 'details', 'event', 'payload', 'properties'] as const;

const PATH_KEYS = ['projectPath', 'workspacePath', 'cwd', 'workspaceFolder', 'rootPath'] as const;

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** `org/repo` style without URL noise. */
function looksLikeOwnerRepo(value: string): boolean {
  const t = value.trim();
  if (t.length < 3 || t.length > 200) return false;
  if (t.includes('://') || t.startsWith('git@')) return false;
  const m = /^[\w.-]+\/[\w.-]+$/i.exec(t);
  return m !== null;
}

function normalizeGithubToOwnerRepo(value: string): string {
  const t = value.trim();
  if (!t) return '';

  const ssh = /^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i.exec(t);
  if (ssh) {
    const o = ssh[1] ?? '';
    const r = ssh[2] ?? '';
    if (o && r) return `${o}/${r}`;
  }

  const scp = /^ssh:\/\/git@github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i.exec(t);
  if (scp) {
    const o = scp[1] ?? '';
    const r = scp[2] ?? '';
    if (o && r) return `${o}/${r}`;
  }

  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (host === 'github.com' || host.endsWith('.github.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const owner = parts[0] ?? '';
        const repo = (parts[1] ?? '').replace(/\.git$/i, '');
        if (owner && repo) return `${owner}/${repo}`;
      }
    }
  } catch {
    // not a URL
  }

  const loose = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\?|#|$)/i.exec(t);
  if (loose) {
    const o = loose[1] ?? '';
    const r = loose[2] ?? '';
    if (o && r) return `${o}/${r}`;
  }

  return '';
}

function normalizeAzureDevOpsToSlug(value: string): string {
  const t = value.trim();
  if (!t) return '';
  try {
    const u = new URL(t);
    if (!u.hostname.toLowerCase().includes('dev.azure.com')) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    const gitIdx = parts.indexOf('_git');
    if (gitIdx > 0 && parts[gitIdx + 1]) {
      const org = parts[0] ?? '';
      const project = parts[1] ?? '';
      const repo = parts[gitIdx + 1] ?? '';
      if (org && project && repo) return `${org}/${project}/${repo}`;
    }
  } catch {
    /* ignore */
  }
  return '';
}

function pathToOrgRepoHint(path: string): string {
  const t = path.trim();
  if (!t) return '';
  const norm = t.replace(/\\/g, '/');
  const lower = norm.toLowerCase();
  const marker = 'github-cpt-group';
  const idx = lower.indexOf(marker);
  if (idx < 0) return '';
  const tail = norm.slice(idx);
  const parts = tail.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const org = parts[0] ?? '';
    const repo = (parts[1] ?? '').replace(/\.git$/i, '');
    if (org && repo) return `${org}/${repo}`;
  }
  return parts[0] ?? '';
}

function collectNestedStringLeaves(obj: Record<string, unknown>, maxDepth: number): string[] {
  const out: string[] = [];
  const walk = (o: Record<string, unknown>, depth: number): void => {
    if (depth > maxDepth) return;
    for (const v of Object.values(o)) {
      if (typeof v === 'string' && v.trim()) {
        out.push(v.trim());
      } else if (v && typeof v === 'object' && !Array.isArray(v) && depth < maxDepth) {
        walk(v as Record<string, unknown>, depth + 1);
      }
    }
  };
  walk(obj, 0);
  return out;
}

/** Max nesting depth under `metadata` / `context` / … (0 = root only). */
const NESTED_LEAF_MAX_DEPTH = 2;

function bestFromCandidateString(candidate: string): string {
  const gh = normalizeGithubToOwnerRepo(candidate);
  if (gh) return gh;
  const az = normalizeAzureDevOpsToSlug(candidate);
  if (az) return az;
  if (looksLikeOwnerRepo(candidate)) return candidate.trim();
  return '';
}

/**
 * Returns a display key for repo bucketing, or empty string when none.
 */
export function extractUsageEventRepoFromRow(r: Record<string, unknown>): string {
  const tried = new Set<string>();

  const consider = (raw: string): string => {
    const t = raw.trim();
    if (!t || tried.has(t)) return '';
    tried.add(t);
    return bestFromCandidateString(t);
  };

  for (const key of FLAT_STRING_KEYS) {
    const hit = consider(trimString(r[key]));
    if (hit) return hit;
  }

  const repositoryObj = r.repository;
  if (repositoryObj && typeof repositoryObj === 'object' && !Array.isArray(repositoryObj)) {
    const repoRec = repositoryObj as Record<string, unknown>;
    for (const key of ['full_name', 'fullName', 'name', 'slug', 'url', 'html_url', 'clone_url'] as const) {
      const hit = consider(trimString(repoRec[key]));
      if (hit) return hit;
    }
  }

  for (const nestKey of NEST_OBJECT_KEYS) {
    const nest = r[nestKey];
    if (!nest || typeof nest !== 'object' || Array.isArray(nest)) continue;
    const n = nest as Record<string, unknown>;
    for (const key of FLAT_STRING_KEYS) {
      const hit = consider(trimString(n[key]));
      if (hit) return hit;
    }
    const subRepo = n.repository;
    if (subRepo && typeof subRepo === 'object' && !Array.isArray(subRepo)) {
      const repoRec = subRepo as Record<string, unknown>;
      for (const key of ['full_name', 'fullName', 'name', 'url'] as const) {
        const hit = consider(trimString(repoRec[key]));
        if (hit) return hit;
      }
    }
    const leaves = collectNestedStringLeaves(n, NESTED_LEAF_MAX_DEPTH);
    for (const leaf of leaves) {
      const hit = consider(leaf);
      if (hit) return hit;
    }
  }

  for (const key of PATH_KEYS) {
    const pathHit = trimString(r[key]);
    const fromPath = pathToOrgRepoHint(pathHit);
    if (fromPath) return fromPath;
  }

  return '';
}
