import {
  GITHUB_DEPLOY_WORKFLOW_MONITORS,
  isPlaceholderDeployMonitor,
  type GitHubDeployLiveWorkflowMonitor,
  type GitHubDeployPlaceholderMonitor,
} from '@/constants/GITHUB_DEPLOY_MONITORS';
import {
  getDedicatedWorkflowIdsForDevTstLane,
  getDeployVersionWorkflowIds,
} from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';
import type {
  GitHubDeployLaneSnapshot,
  GitHubDeployRunSummary,
  GitHubDeployWorkflowStatus,
} from '@/types/github/GitHubDeployStatus';
import {
  getDeployLaneConfig,
  getNaLaneLabel,
  mapEnvironmentToLane,
  normalizeDeployEnvironment,
  parseDeployEnvironmentFromJobName,
  parseDeployEnvironmentFromRunName,
  type DeployEnvironmentKey,
  type DeployLaneKey,
} from '@/utils/githubDeployEnvironment';
import {
  buildDeploymentLaneSnapshot,
  buildRunLaneSnapshot,
  laneStateFromDeploymentState,
  laneStateFromRunStatus,
} from '@/utils/githubDeployLaneSnapshots';
import {
  isP2pGoServiceRepo,
  resolveP2pRunEnvironment,
  type P2pDeploymentHint,
  type P2pRunEnvironmentInput,
} from '@/utils/p2pDeployEnvironment';

export interface GitHubWorkflowRunApi {
  actor?: {
    login?: string | null;
  } | null;
  id: number;
  run_number: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  head_sha?: string | null;
  html_url: string;
  display_title?: string | null;
  created_at: string;
  updated_at: string;
}

interface GitHubWorkflowRunsResponse {
  total_count?: number;
  workflow_runs: GitHubWorkflowRunApi[];
}

function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cpt-internal-dashboard',
  };
}

function toHeadShaShort(headSha: string | null | undefined): string | null {
  const trimmed = headSha?.trim() ?? '';
  if (trimmed.length < 7) return trimmed.length > 0 ? trimmed : null;
  return trimmed.slice(0, 7);
}

/** One row from GET /repos/{owner}/{repo}/deployments — carries the TARGET environment. */
interface RepoDeployment {
  /** GitHub Deployment id — used to fetch its statuses for the authoritative run link. */
  id: number;
  environment: DeployEnvironmentKey;
  sha: string;
  createdAtMs: number;
}

/**
 * Authoritative `runId → environment` linkage built from GitHub Deployment statuses.
 * Every Deploy Version run shares `headBranch === 'development'` and (for a promotion wave)
 * the same head SHA, so neither the branch nor the SHA can separate tst/stg/prd. The
 * deployment that the run created, however, carries the exact TARGET `environment`, and its
 * status rows carry a `log_url` that contains `/actions/runs/<runId>` — a deterministic
 * deployment→run link that survives the same-SHA multi-deployment collision (EF's pattern).
 */
type DeploymentRunEnvironmentIndex = ReadonlyMap<number, DeployEnvironmentKey>;

/**
 * Last GitHub Deployments API fetch outcome per `owner/repo`. Deployments feed the stg/prod lane
 * snapshots; when the read token cannot see a repo's Deployments API the fetch returns a non-2xx
 * and we previously swallowed it (`return []`) — silently emptying stg/prod. Record the outcome so
 * the API can surface it (a 403/404 here means "grant the token Deployments: read").
 */
interface DeploymentsFetchDiag {
  ok: boolean;
  status: number;
  count: number;
}
const lastDeploymentsFetchDiag = new Map<string, DeploymentsFetchDiag>();
function getDeploymentsFetchDiag(owner: string, repo: string): DeploymentsFetchDiag | undefined {
  return lastDeploymentsFetchDiag.get(`${owner}/${repo}`);
}

/**
 * How many deployments to pull per GitHub `environment` filter. Lane pills only need the newest
 * row; a small window also feeds SHA→env timeline heuristics without drowning in dev/tst spam.
 * (Unfiltered `per_page=100` was dropping multi-day-old `prd` behind a flood of lower envs.)
 */
const DEPLOYMENTS_PER_ENV = 8;

type DeploymentApiRow = {
  id?: number | null;
  environment?: string | null;
  sha?: string | null;
  created_at?: string | null;
};

/**
 * GitHub Deployments API `environment` query names for a lane key.
 * Standardized CD repos use `stg` / `prd` (not `prod`). P2P uses on-prem env names.
 */
export function githubDeploymentEnvironmentNames(
  repo: string,
  env: DeployEnvironmentKey
): readonly string[] {
  if (isP2pGoServiceRepo(repo)) {
    if (env === 'stg') return ['onprem-nonprod'];
    if (env === 'prod') return ['onprem-prd'];
    return [];
  }
  switch (env) {
    case 'dev':
      return ['dev'];
    case 'tst':
      return ['tst'];
    case 'stg':
      return ['stg'];
    case 'prod':
      return ['prd'];
    default:
      return [];
  }
}

function parseDeploymentApiRows(data: DeploymentApiRow[]): RepoDeployment[] {
  const out: RepoDeployment[] = [];
  for (const d of data) {
    const env = normalizeDeployEnvironment(d.environment);
    const createdAtMs = Date.parse(d.created_at ?? '');
    if (typeof d.id === 'number' && env && d.sha && Number.isFinite(createdAtMs)) {
      out.push({ id: d.id, environment: env, sha: d.sha, createdAtMs });
    }
  }
  return out;
}

async function fetchDeploymentsForGithubEnvironment(
  token: string,
  owner: string,
  repo: string,
  githubEnvironment: string
): Promise<{ ok: boolean; status: number; deployments: RepoDeployment[] }> {
  const url =
    `https://api.github.com/repos/${owner}/${repo}/deployments` +
    `?environment=${encodeURIComponent(githubEnvironment)}&per_page=${DEPLOYMENTS_PER_ENV}`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, status: res.status, deployments: [] };
    }
    const data = (await res.json()) as DeploymentApiRow[];
    if (!Array.isArray(data)) {
      return { ok: false, status: res.status, deployments: [] };
    }
    return { ok: true, status: res.status, deployments: parseDeploymentApiRows(data) };
  } catch {
    return { ok: false, status: -1, deployments: [] };
  }
}

/**
 * Fetch recent Deployments **per environment** (parallel, small pages).
 * Lane pills for stg/prod need the latest deploy for that env; an unfiltered top-100 list
 * was missing `prd` when lower envs were busy. Empty env = never deployed (not an API error).
 */
async function fetchRepoDeploymentsForLanes(
  token: string,
  owner: string,
  repo: string,
  laneEnvs: readonly DeployEnvironmentKey[]
): Promise<RepoDeployment[]> {
  const diagKey = `${owner}/${repo}`;
  const githubEnvs = [
    ...new Set(laneEnvs.flatMap((env) => githubDeploymentEnvironmentNames(repo, env))),
  ];
  if (githubEnvs.length === 0) {
    lastDeploymentsFetchDiag.set(diagKey, { ok: true, status: 200, count: 0 });
    return [];
  }

  const results = await Promise.all(
    githubEnvs.map((githubEnvironment) =>
      fetchDeploymentsForGithubEnvironment(token, owner, repo, githubEnvironment)
    )
  );

  const failed = results.find((r) => !r.ok);
  const deployments = results.flatMap((r) => r.deployments);
  if (failed) {
    // Do NOT swallow: a 403/404/503 here would empty stg/prod with no visible error.
    lastDeploymentsFetchDiag.set(diagKey, {
      ok: false,
      status: failed.status,
      count: deployments.length,
    });
    // Still return any successful env slices so one bad filter does not blank every lane.
    return deployments;
  }

  lastDeploymentsFetchDiag.set(diagKey, { ok: true, status: 200, count: deployments.length });
  return deployments;
}

const ACTIONS_RUN_ID_PATTERN = /\/actions\/runs\/(\d+)/;

/** Extract the originating Actions run id from a deployment-status `log_url` / `target_url`. */
function runIdFromStatusUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  const match = url.match(ACTIONS_RUN_ID_PATTERN);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

interface DeploymentStatusApi {
  state?: string | null;
  log_url?: string | null;
  target_url?: string | null;
  created_at?: string | null;
}

/** The latest deployment status: its `state`, originating run id, run link, and timestamp. */
interface DeploymentLatestStatus {
  state: string | null;
  runId: number | null;
  logUrl: string | null;
  createdAt: string | null;
}

/**
 * For a single deployment, read its most recent status. `per_page=1` is enough: every status row
 * for a deployment points at the same run, and the `log_url` link is present from the first
 * (`waiting`/`queued`) status onward — so this resolves even a still-queued upper-env run onto
 * its env row AND captures the live `state` for the lane pill.
 */
async function fetchDeploymentLatestStatus(
  token: string,
  owner: string,
  repo: string,
  deploymentId: number
): Promise<DeploymentLatestStatus | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=1`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as DeploymentStatusApi[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const status = data[0];
    const logUrl = status.log_url ?? status.target_url ?? null;
    return {
      state: status.state ?? null,
      runId: runIdFromStatusUrl(status.log_url) ?? runIdFromStatusUrl(status.target_url),
      logUrl,
      createdAt: status.created_at ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Latest deployment per env (newest by `created_at`). Used to anchor stg/prod lane snapshots on
 * the FULL deploy history rather than the truncated recent-runs window — the regression fix.
 */
function latestDeploymentPerEnvironment(
  deployments: readonly RepoDeployment[]
): Map<DeployEnvironmentKey, RepoDeployment> {
  const latest = new Map<DeployEnvironmentKey, RepoDeployment>();
  for (const d of deployments) {
    const current = latest.get(d.environment);
    if (!current || d.createdAtMs > current.createdAtMs) {
      latest.set(d.environment, d);
    }
  }
  return latest;
}

/**
 * Build stg/prod lane snapshots from the GitHub Deployments API: for each env's LATEST
 * deployment, read its latest status (`state`) and map it to the lane pill. This is the
 * authoritative env-row source — it covers full deploy history and gives live
 * queued→in_progress→done, immune to the recent-runs(30) truncation that caused the N/A
 * regression. P2P is intentionally excluded (its on-prem `onprem-nonprod`/`onprem-prd` envs
 * can't separate tst/stg, and stg has no deployment at all — it keeps its dedicated resolver).
 */
async function buildDeploymentLaneSnapshots(
  token: string,
  owner: string,
  repo: string,
  deployments: readonly RepoDeployment[],
  envLanes: readonly DeployEnvironmentKey[]
): Promise<Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>>> {
  const latestByEnv = latestDeploymentPerEnvironment(deployments);
  const out: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = {};
  const probes = await Promise.all(
    envLanes.map(async (env) => {
      const deployment = latestByEnv.get(env);
      if (!deployment) return { env, deployment: null, status: null };
      const status = await fetchDeploymentLatestStatus(token, owner, repo, deployment.id);
      return { env, deployment, status };
    })
  );
  for (const { env, deployment, status } of probes) {
    if (!deployment) continue;
    const lane = mapEnvironmentToLane(repo, env);
    out[lane] = buildDeploymentLaneSnapshot({
      lane,
      env,
      state: laneStateFromDeploymentState(status?.state ?? null),
      statusCreatedAt: status?.createdAt ?? null,
      deploymentCreatedAt: new Date(deployment.createdAtMs).toISOString(),
      logUrl: status?.logUrl ?? null,
    });
  }
  return out;
}

const ENV_CORRELATION_WINDOW_MS = 45 * 60 * 1000;

/**
 * Resolve a run's TARGET environment — used ONLY to label the recentRuns timeline. The accurate
 * per-lane pills come from the Deployments-API lane snapshots (buildDeploymentLaneSnapshots), NOT
 * from this.
 *
 * The deployment-status `runId → environment` index is no longer built (it cost ~240 GitHub
 * calls/refresh and 403-rate-limited the whole board), so `runEnvIndex` is always empty and this
 * always takes the heuristic path: match by head SHA — every Deploy Version run shares
 * `development`'s SHA — disambiguated by the deployment whose creation time is closest. Returns null
 * when no confident match exists (the caller then falls back to the branch). The `runEnvIndex` param
 * is retained so a future deterministic source can repopulate it without touching callers.
 */
function runDisplayTitle(run: GitHubWorkflowRunApi): string {
  if (run.display_title && run.display_title.trim() !== '') return run.display_title.trim();
  return (run.name ?? '').trim();
}

function resolveRunEnvironment(
  run: GitHubWorkflowRunApi,
  deployments: readonly RepoDeployment[],
  runEnvIndex: DeploymentRunEnvironmentIndex
): DeployEnvironmentKey | null {
  const linked = runEnvIndex.get(run.id);
  if (linked) return linked;

  // run-name / display title (e.g. "Deploy Version — stg") — available before Deployments exist.
  const fromName = parseDeployEnvironmentFromRunName(runDisplayTitle(run));
  if (fromName) return fromName;

  const headSha = run.head_sha?.trim() ?? '';
  const runMs = Date.parse(run.created_at);
  if (!headSha || !Number.isFinite(runMs) || deployments.length === 0) return null;
  const shaKey = headSha.slice(0, 12);

  let best: RepoDeployment | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const d of deployments) {
    if (d.sha.slice(0, 12) !== shaKey) continue;
    const delta = Math.abs(d.createdAtMs - runMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = d;
    }
  }
  if (!best || bestDelta > ENV_CORRELATION_WINDOW_MS) return null;
  return best.environment;
}

function toP2pDeploymentHints(deployments: readonly RepoDeployment[]): P2pDeploymentHint[] {
  return deployments.map((d) => ({
    environment: d.environment,
    sha: d.sha,
    createdAtMs: d.createdAtMs,
  }));
}

function resolveEnvironmentForWorkflowRun(
  repo: string,
  run: GitHubWorkflowRunApi,
  workflowId: number,
  allRuns: readonly { run: GitHubWorkflowRunApi; workflowId: number }[],
  deployments: readonly RepoDeployment[],
  runEnvIndex: DeploymentRunEnvironmentIndex
): DeployEnvironmentKey | null {
  if (isP2pGoServiceRepo(repo)) {
    // P2P deployments use `onprem-nonprod` / `onprem-prd`: the nonprod env can't separate
    // tst vs stg, so the deployment→run index can only confirm prod. Keep P2P on its
    // dedicated promote-wave resolver (which already derives prod from onprem-prd hints).
    const p2pRuns: P2pRunEnvironmentInput[] = allRuns.map(({ run: candidate, workflowId: candidateWorkflowId }) => ({
      workflowId: candidateWorkflowId,
      headSha: candidate.head_sha,
      createdAt: candidate.created_at,
      status: candidate.status,
      conclusion: candidate.conclusion,
    }));
    const current: P2pRunEnvironmentInput = {
      workflowId,
      headSha: run.head_sha,
      createdAt: run.created_at,
      status: run.status,
      conclusion: run.conclusion,
    };
    return resolveP2pRunEnvironment(current, p2pRuns, toP2pDeploymentHints(deployments));
  }
  return resolveRunEnvironment(run, deployments, runEnvIndex);
}

function toSummary(
  run: GitHubWorkflowRunApi,
  workflowId: number,
  resolvedEnvironment: DeployEnvironmentKey | null
): GitHubDeployRunSummary {
  const title =
    (run.display_title && run.display_title.trim() !== '') ? run.display_title : (run.name ?? `#${run.id}`);
  return {
    id: run.id,
    runNumber: typeof run.run_number === 'number' ? run.run_number : 0,
    status: run.status,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    headShaShort: toHeadShaShort(run.head_sha),
    actorLogin: run.actor?.login ?? null,
    title,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    workflowId,
    resolvedEnvironment,
  };
}

function shortLabel(repo: string): string {
  return repo.replace(/^cpt-/, '');
}

function isQueuedLikeStatus(status: string): boolean {
  return status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested';
}

function monitorWorkflowIds(monitor: GitHubDeployLiveWorkflowMonitor): number[] {
  const ids = [monitor.workflowId, ...(monitor.workflowIds ?? [])];
  return [...new Set(ids)];
}

async function fetchWorkflowRunCountByStatus(
  token: string,
  owner: string,
  repo: string,
  workflowId: number,
  status: 'queued' | 'in_progress'
): Promise<number> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?status=${status}&per_page=1`;
  const res = await fetch(url, {
    headers: githubHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as GitHubWorkflowRunsResponse;
  return typeof data.total_count === 'number' ? data.total_count : 0;
}

interface WorkflowRunsFetchResult {
  workflowId: number;
  runs: GitHubWorkflowRunApi[];
  queuedCount: number;
  inProgressCount: number;
  error?: string;
}

async function fetchWorkflowRunsById(
  token: string,
  owner: string,
  repo: string,
  workflowId: number
): Promise<WorkflowRunsFetchResult> {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=50`;

  try {
    const res = await fetch(url, {
      headers: githubHeaders(token),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        workflowId,
        runs: [],
        queuedCount: 0,
        inProgressCount: 0,
        error: `GitHub ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`,
      };
    }

    const [data, queuedCount, inProgressCount] = await Promise.all([
      res.json() as Promise<GitHubWorkflowRunsResponse>,
      fetchWorkflowRunCountByStatus(token, owner, repo, workflowId, 'queued'),
      fetchWorkflowRunCountByStatus(token, owner, repo, workflowId, 'in_progress'),
    ]);

    return {
      workflowId,
      runs: Array.isArray(data.workflow_runs) ? data.workflow_runs : [],
      queuedCount,
      inProgressCount,
    };
  } catch (e) {
    return {
      workflowId,
      runs: [],
      queuedCount: 0,
      inProgressCount: 0,
      error: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export function buildPlaceholderDeployStatus(
  monitor: GitHubDeployPlaceholderMonitor
): GitHubDeployWorkflowStatus {
  const shortLabel =
    monitor.shortLabel?.trim() !== '' ? monitor.shortLabel! : monitor.repo.replace(/^cpt-/, '');
  return {
    owner: monitor.owner,
    repo: monitor.repo,
    shortLabel,
    isPlaceholder: true,
    recentRuns: [],
  };
}

export interface FetchedRunEntry {
  run: GitHubWorkflowRunApi;
  workflowId: number;
}

/** Newest fetched run (by `updated_at`) whose workflow id is in `allowedWorkflowIds`. */
function latestRunForWorkflowIds(
  runs: readonly FetchedRunEntry[],
  allowedWorkflowIds: readonly number[]
): FetchedRunEntry | undefined {
  const allowed = new Set(allowedWorkflowIds);
  let latest: FetchedRunEntry | undefined;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const entry of runs) {
    if (!allowed.has(entry.workflowId)) continue;
    const ms = Date.parse(entry.run.updated_at);
    if (!Number.isFinite(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = entry;
  }
  return latest;
}

/**
 * Select a lane's representative run treating `orderedWorkflowIds` as a PRIORITY list, not a set of
 * equals. The FIRST id is the lane's AUTHORITATIVE/terminal workflow (e.g. TST Build Artifact — the
 * workflow that actually publishes the release); any later id is a promoter/orchestrator (e.g. TST
 * Auto-Merge — the dev→test merge that *dispatches* the build).
 *
 * Rule: use the authoritative workflow's latest run, EXCEPT when a lower-priority (promoter) workflow
 * has a run that is BOTH newer AND still active (in_progress/queued) — an in-flight promotion the
 * build hasn't produced yet — in which case surface that active run so the lane reflects the
 * promotion. A COMPLETED promoter run (success OR failure) NEVER overrides the authoritative run: a
 * promoter that merely times out on its required-checks poll — or is a zombie left behind after the
 * PR was merged by another actor — must not paint the lane as a failed RELEASE when the build itself
 * succeeded (NOVA-3208: a failed TST Auto-Merge at 22:20 was outranking a successful TST Build at
 * 22:04, reddening the nuget Release lane for a promotion that in fact shipped to test/stg/prod).
 * Only when the authoritative workflow has NO run at all do we fall back to the promoter's latest run.
 *
 * For a single-id list this is exactly `latestRunForWorkflowIds`, so behavior is UNCHANGED for every
 * lane except a multi-id one (today only nuget's Release/tst lane [TST Build, TST Auto-Merge]).
 */
function latestRunByLanePriority(
  runs: readonly FetchedRunEntry[],
  orderedWorkflowIds: readonly number[]
): FetchedRunEntry | undefined {
  if (orderedWorkflowIds.length <= 1) {
    return latestRunForWorkflowIds(runs, orderedWorkflowIds);
  }
  const [authoritativeId, ...promoterIds] = orderedWorkflowIds;
  const authoritative = latestRunForWorkflowIds(runs, [authoritativeId]);
  const promoter = latestRunForWorkflowIds(runs, promoterIds);

  // In-flight promotion: a newer, still-active promoter run the build hasn't caught up to yet.
  if (promoter && promoter.run.status !== 'completed') {
    const promoterMs = Date.parse(promoter.run.updated_at);
    const authoritativeMs = authoritative
      ? Date.parse(authoritative.run.updated_at)
      : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(promoterMs) && promoterMs > authoritativeMs) {
      return promoter;
    }
  }

  return authoritative ?? promoter;
}

const DEV_TST_SNAPSHOT_LANES: readonly ('dev' | 'tst')[] = ['dev', 'tst'];

/**
 * Build dev/tst lane snapshots from each lane's DEDICATED workflow's latest run (Dev Fast / TST
 * Build), matched by workflow id — never by branch (Deploy Version & TST Build both run on
 * `development`) and never by env-resolution (TST Build creates no env-gated deployment), and
 * deliberately EXCLUDING the Deploy Version promoter (which targets stg/prd, not the Tst lane).
 * This is why EF's TST lane now shows the real TST Build FAIL instead of N/A.
 */
export function buildRunBasedLaneSnapshots(
  repo: string,
  runs: readonly FetchedRunEntry[]
): Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> {
  const out: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = {};
  const laneConfig = getDeployLaneConfig(repo);
  for (const lane of DEV_TST_SNAPSHOT_LANES) {
    if (!laneConfig.order.includes(lane)) continue;
    if (getNaLaneLabel(repo, lane)) continue;
    const workflowIds = getDedicatedWorkflowIdsForDevTstLane(repo, lane);
    if (workflowIds.length === 0) continue;
    // Priority-ordered: the dedicated id list is [authoritative build, …promoter]; a completed
    // promoter (e.g. a timed-out TST Auto-Merge) must not outrank the build that actually shipped.
    const entry = latestRunByLanePriority(runs, workflowIds);
    if (!entry) continue;
    out[lane] = buildRunLaneSnapshot({
      lane,
      state: laneStateFromRunStatus(entry.run.status, entry.run.conclusion),
      createdAt: entry.run.created_at,
      updatedAt: entry.run.updated_at,
      title:
        entry.run.display_title && entry.run.display_title.trim() !== ''
          ? entry.run.display_title
          : entry.run.name,
      branch: entry.run.head_branch,
      htmlUrl: entry.run.html_url,
    });
  }
  return out;
}

/**
 * Env keys whose stg/prod lane snapshots come from the Deployments API.
 * P2P (on-prem Go service) deploys to `onprem-nonprod` (→ stg lane, its pre-prod target) and
 * `onprem-prd` (→ prod). Both are deployment-sourced so p2p's stg shows its real nonprod deploy
 * instead of N/A (dev/tst still come from the dedicated workflow runs).
 */
function deploymentLaneEnvsForRepo(repo: string): DeployEnvironmentKey[] {
  if (isP2pGoServiceRepo(repo)) return ['stg', 'prod'];
  const laneConfig = getDeployLaneConfig(repo);
  const envs: DeployEnvironmentKey[] = [];
  for (const env of ['stg', 'prod'] as const) {
    const lane = mapEnvironmentToLane(repo, env);
    if (!laneConfig.order.includes(lane)) continue;
    // Package-repo stg/prod ("N/A — package repo") have no deploy target — never probe them.
    if (getNaLaneLabel(repo, lane)) continue;
    envs.push(env);
  }
  return envs;
}

/**
 * Reclassify a `failed` lane snapshot to `cancelled` when its originating run was deliberately
 * cancelled. GitHub reports a cancelled deploy run's Deployment status as `error` (→ `failed`),
 * but a cancelled deploy is NOT a failure — the env is unchanged (e.g. an agent cancels a stg
 * deploy to hold deploy ordering). The run is looked up in the ALREADY-fetched runs by the id
 * embedded in the snapshot's htmlUrl (`/actions/runs/<id>`), so this costs no extra API call.
 */
function reclassifyCancelledLaneSnapshots(
  laneSnapshots: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>>,
  runs: readonly FetchedRunEntry[]
): Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> {
  const out: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = { ...laneSnapshots };
  for (const key of Object.keys(out) as DeployLaneKey[]) {
    const snap = out[key];
    if (!snap || snap.state !== 'failed' || !snap.htmlUrl) continue;
    const runId = runIdFromStatusUrl(snap.htmlUrl);
    if (runId === null) continue;
    const entry = runs.find((r) => r.run.id === runId);
    if (entry && entry.run.status === 'completed' && entry.run.conclusion === 'cancelled') {
      out[key] = { ...snap, state: 'cancelled' };
    }
  }
  return out;
}

interface GitHubWorkflowJobApi {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
}

/**
 * When `run-name` is missing (legacy workflow file / accidental dispatch), infer the Deploy Version
 * target from job names like `Deploy supportrequestapi (tst)`. One jobs list call per orphan run.
 */
async function resolveDeployVersionEnvFromJobs(
  token: string,
  owner: string,
  repo: string,
  runId: number
): Promise<DeployEnvironmentKey | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=40`;
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { jobs?: GitHubWorkflowJobApi[] };
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    for (const job of jobs) {
      const env = parseDeployEnvironmentFromJobName(job.name);
      if (env) return env;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveActiveDeployVersionEnvs(
  token: string,
  owner: string,
  repo: string,
  runs: readonly FetchedRunEntry[]
): Promise<Map<number, DeployEnvironmentKey>> {
  const deployVersionIds = new Set(getDeployVersionWorkflowIds(repo));
  const resolved = new Map<number, DeployEnvironmentKey>();
  if (deployVersionIds.size === 0) return resolved;

  const orphanRuns = runs.filter((entry) => {
    if (!deployVersionIds.has(entry.workflowId)) return false;
    if (entry.run.status === 'completed') return false;
    const fromTitle = parseDeployEnvironmentFromRunName(runDisplayTitle(entry.run));
    if (fromTitle) {
      resolved.set(entry.run.id, fromTitle);
      return false;
    }
    return true;
  });

  await Promise.all(
    orphanRuns.map(async (entry) => {
      const fromJobs = await resolveDeployVersionEnvFromJobs(token, owner, repo, entry.run.id);
      if (fromJobs) resolved.set(entry.run.id, fromJobs);
    })
  );
  return resolved;
}

/**
 * Overlay in-flight Deploy Version runs onto their TARGET lane as soon as the run exists.
 *
 * Dedicated Dev/Tst snapshots deliberately exclude Deploy Version (so promotes do not paint Dev/Tst
 * via `development`). Stg/Prod wait on the Deployments API — but app CD now runs
 * `verify-promotion-order` before the env-gated job, so Actions shows In Progress while no
 * Deployment exists yet. Parse `run-name` / display title (`Deploy Version — stg`), or a pre-resolved
 * env from job names when run-name is missing, and light that lane immediately. Only non-completed
 * runs overlay; completed state stays on Deployments / dedicated workflows.
 */
export function overlayActiveDeployVersionLaneSnapshots(
  repo: string,
  runs: readonly FetchedRunEntry[],
  laneSnapshots: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>>,
  envByRunId?: ReadonlyMap<number, DeployEnvironmentKey>
): Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> {
  const deployVersionIds = new Set(getDeployVersionWorkflowIds(repo));
  if (deployVersionIds.size === 0) return laneSnapshots;

  const laneConfig = getDeployLaneConfig(repo);
  const out: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = { ...laneSnapshots };

  // Newest-first: if multiple in-flight Deploy Version runs target the same lane, keep the newest.
  for (const entry of runs) {
    if (!deployVersionIds.has(entry.workflowId)) continue;
    if (entry.run.status === 'completed') continue;

    const title = runDisplayTitle(entry.run);
    const env =
      envByRunId?.get(entry.run.id) ?? parseDeployEnvironmentFromRunName(title);
    if (!env) continue;

    const lane = mapEnvironmentToLane(repo, env);
    if (!laneConfig.order.includes(lane)) continue;
    if (getNaLaneLabel(repo, lane)) continue;

    const existing = out[lane];
    // Do not clobber a newer overlay already written for this lane.
    if (existing && (existing.state === 'running' || existing.state === 'queued') && existing.updatedAt) {
      const existingMs = Date.parse(existing.updatedAt);
      const entryMs = Date.parse(entry.run.updated_at);
      if (Number.isFinite(existingMs) && Number.isFinite(entryMs) && existingMs >= entryMs) {
        continue;
      }
    }

    // GitHub often keeps the run-level status as `queued` while matrix jobs are already running —
    // prefer `running` when the run is non-completed so the lane matches Actions reality.
    const laneState =
      entry.run.status === 'completed'
        ? laneStateFromRunStatus(entry.run.status, entry.run.conclusion)
        : entry.run.status === 'queued' || entry.run.status === 'waiting' || entry.run.status === 'pending'
          ? 'running'
          : laneStateFromRunStatus(entry.run.status, entry.run.conclusion);

    out[lane] = buildRunLaneSnapshot({
      lane,
      state: laneState,
      createdAt: entry.run.created_at,
      updatedAt: entry.run.updated_at,
      title: title || entry.run.name,
      branch: entry.run.head_branch,
      htmlUrl: entry.run.html_url,
    });
  }
  return out;
}

export async function fetchDeployWorkflowStatus(
  token: string,
  monitor: GitHubDeployLiveWorkflowMonitor
): Promise<GitHubDeployWorkflowStatus> {
  const { owner, repo, workflowId } = monitor;
  const base: GitHubDeployWorkflowStatus = {
    owner,
    repo,
    workflowId,
    shortLabel: shortLabel(repo),
  };

  const workflowIds = monitorWorkflowIds(monitor);
  const deploymentLaneEnvs = deploymentLaneEnvsForRepo(repo);
  const [workflowFetches, deployments] = await Promise.all([
    Promise.all(workflowIds.map((id) => fetchWorkflowRunsById(token, owner, repo, id))),
    // Per-env Deployments (`?environment=stg|prd`, per_page=8) — not unfiltered top-100.
    fetchRepoDeploymentsForLanes(token, owner, repo, deploymentLaneEnvs),
  ]);

  // Stg/prod lane pills come from buildDeploymentLaneSnapshots — the latest deployment per env plus
  // its status (2 probes/repo). We deliberately DO NOT build the 40-per-repo deployment→run env
  // index anymore: at ~240 GitHub calls/refresh it rate-limited the Deployments API. Timeline
  // env labels fall back to run-name + SHA/time over this small per-env list.
  const runEnvIndex: DeploymentRunEnvironmentIndex = new Map();
  const deploymentLaneSnapshots = await buildDeploymentLaneSnapshots(
    token,
    owner,
    repo,
    deployments,
    deploymentLaneEnvs
  );

  const successful = workflowFetches.filter((f) => !f.error);

  if (successful.length === 0) {
    return {
      ...base,
      error: workflowFetches.find((f) => f.error)?.error ?? 'Request failed',
    };
  }

  const queuedCount = successful.reduce((sum, f) => sum + f.queuedCount, 0);
  const inProgressCount = successful.reduce((sum, f) => sum + f.inProgressCount, 0);
  const runs = successful
    .flatMap((f) => f.runs.map((run) => ({ run, workflowId: f.workflowId })))
    .sort((a, b) => Date.parse(b.run.updated_at) - Date.parse(a.run.updated_at));

  const allRunEntries = runs;

  const activeEntry = runs.find(({ run }) => run.status === 'in_progress')
    ?? runs.find(({ run }) => isQueuedLikeStatus(run.status))
    ?? runs.find(({ run }) => run.status !== 'completed');
  const lastDoneEntry = runs.find(({ run }) => run.status === 'completed');

  // Resolve Deploy Version targets (run-name, else job-name fallback) before overlay so orphan
  // promotes (bare "Deploy Version" titles) still light tst/stg/prd during verify-promotion-order.
  const deployVersionEnvs = await resolveActiveDeployVersionEnvs(token, owner, repo, runs);

  // dev/tst ← dedicated workflow; stg/prod ← Deployments API; then overlay in-flight Deploy Version
  // so promotes light the lane during verify-promotion-order before Deployments exist.
  const laneSnapshots: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = reclassifyCancelledLaneSnapshots(
    overlayActiveDeployVersionLaneSnapshots(
      repo,
      runs,
      {
        ...buildRunBasedLaneSnapshots(repo, runs),
        ...deploymentLaneSnapshots,
      },
      deployVersionEnvs
    ),
    runs
  );

  return {
    ...base,
    laneSnapshots: Object.keys(laneSnapshots).length > 0 ? laneSnapshots : undefined,
    deploymentsDiag: getDeploymentsFetchDiag(owner, repo),
    queuedCount,
    inProgressCount,
    activeCount: queuedCount + inProgressCount,
    activeRun: activeEntry
      ? toSummary(
          activeEntry.run,
          activeEntry.workflowId,
          resolveEnvironmentForWorkflowRun(repo, activeEntry.run, activeEntry.workflowId, allRunEntries, deployments, runEnvIndex)
        )
      : undefined,
    lastCompletedRun: lastDoneEntry
      ? toSummary(
          lastDoneEntry.run,
          lastDoneEntry.workflowId,
          resolveEnvironmentForWorkflowRun(repo, lastDoneEntry.run, lastDoneEntry.workflowId, allRunEntries, deployments, runEnvIndex)
        )
      : undefined,
    recentRuns: runs
      .slice(0, 30)
      .map(({ run, workflowId }) =>
        toSummary(run, workflowId, resolveEnvironmentForWorkflowRun(repo, run, workflowId, allRunEntries, deployments, runEnvIndex))
      ),
  };
}

export async function fetchAllDeployWorkflowStatuses(
  token: string,
  monitors: readonly GitHubDeployLiveWorkflowMonitor[]
): Promise<GitHubDeployWorkflowStatus[]> {
  return Promise.all(monitors.map((m) => fetchDeployWorkflowStatus(token, m)));
}

/** Merge live fetch results with placeholders in `GITHUB_DEPLOY_WORKFLOW_MONITORS` order. */
export function mergeDeployStatusesInMonitorOrder(
  liveResults: readonly GitHubDeployWorkflowStatus[]
): GitHubDeployWorkflowStatus[] {
  const liveByRepo = new Map(liveResults.map((row) => [row.repo, row] as const));
  return GITHUB_DEPLOY_WORKFLOW_MONITORS.map((monitor) => {
    if (isPlaceholderDeployMonitor(monitor)) {
      return buildPlaceholderDeployStatus(monitor);
    }
    const live = liveByRepo.get(monitor.repo);
    if (live) {
      return live;
    }
    return {
      owner: monitor.owner,
      repo: monitor.repo,
      workflowId: monitor.workflowId,
      shortLabel: monitor.repo.replace(/^cpt-/, ''),
      error: 'Missing deploy status for monitored workflow',
    };
  });
}
