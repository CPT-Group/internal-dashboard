import {
  GITHUB_DEPLOY_WORKFLOW_MONITORS,
  isPlaceholderDeployMonitor,
  type GitHubDeployLiveWorkflowMonitor,
  type GitHubDeployPlaceholderMonitor,
} from '@/constants/GITHUB_DEPLOY_MONITORS';
import type { GitHubDeployRunSummary, GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';
import { normalizeDeployEnvironment, type DeployEnvironmentKey } from '@/utils/githubDeployEnvironment';
import {
  isP2pGoServiceRepo,
  resolveP2pRunEnvironment,
  type P2pDeploymentHint,
  type P2pRunEnvironmentInput,
} from '@/utils/p2pDeployEnvironment';

interface GitHubWorkflowRunApi {
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
 * Fetch the repo's recent GitHub Deployments. Each deployment records the env-gated job's
 * `environment` (dev/tst/stg/prd) — the only API source of a Deploy Version run's TARGET env,
 * since the workflow-run object never exposes it and the branch is always `development`.
 */
async function fetchRepoDeployments(token: string, owner: string, repo: string): Promise<RepoDeployment[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=100`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      id?: number | null;
      environment?: string | null;
      sha?: string | null;
      created_at?: string | null;
    }>;
    if (!Array.isArray(data)) return [];
    const out: RepoDeployment[] = [];
    for (const d of data) {
      const env = normalizeDeployEnvironment(d.environment);
      const createdAtMs = Date.parse(d.created_at ?? '');
      if (typeof d.id === 'number' && env && d.sha && Number.isFinite(createdAtMs)) {
        out.push({ id: d.id, environment: env, sha: d.sha, createdAtMs });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Cap on how many recent deployments we probe for their originating run. The dashboard only
 * renders the most recent ~30 runs per repo, so probing the newest N deployments (one cheap
 * `per_page=1` status call each, run concurrently) covers everything on-screen while bounding
 * API cost. Older runs without a link fall back to the legacy SHA+time heuristic.
 */
const DEPLOYMENT_STATUS_PROBE_LIMIT = 40;

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
  log_url?: string | null;
  target_url?: string | null;
}

/**
 * For a single deployment, read its most recent status and return the originating run id.
 * `per_page=1` is enough: every status row for a deployment points at the same run, and the
 * link is present from the first (`waiting`/`queued`) status onward — so this resolves even
 * a still-queued upper-env run onto its env row.
 */
async function fetchDeploymentRunId(
  token: string,
  owner: string,
  repo: string,
  deploymentId: number
): Promise<number | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=1`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as DeploymentStatusApi[];
    if (!Array.isArray(data) || data.length === 0) return null;
    const status = data[0];
    return runIdFromStatusUrl(status.log_url) ?? runIdFromStatusUrl(status.target_url);
  } catch {
    return null;
  }
}

/**
 * Build the authoritative `runId → environment` index from deployment statuses. Probes the
 * newest `DEPLOYMENT_STATUS_PROBE_LIMIT` deployments concurrently. If two deployments in the
 * same env map to the same run (re-deploys), the env is identical so order is irrelevant; a
 * run is only ever recorded against the env its own deployment targeted.
 */
async function buildDeploymentRunEnvironmentIndex(
  token: string,
  owner: string,
  repo: string,
  deployments: readonly RepoDeployment[]
): Promise<DeploymentRunEnvironmentIndex> {
  const recent = [...deployments]
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, DEPLOYMENT_STATUS_PROBE_LIMIT);
  const index = new Map<number, DeployEnvironmentKey>();
  const links = await Promise.all(
    recent.map(async (d) => ({ env: d.environment, runId: await fetchDeploymentRunId(token, owner, repo, d.id) }))
  );
  for (const { env, runId } of links) {
    if (runId !== null && !index.has(runId)) {
      index.set(runId, env);
    }
  }
  return index;
}

const ENV_CORRELATION_WINDOW_MS = 45 * 60 * 1000;

/**
 * Resolve a run's TARGET environment.
 *
 * PRIMARY (deterministic): consult the deployment-status `runId → environment` index. This is
 * the authoritative deployment→run link (from each deployment's status `log_url`) and is
 * immune to the same-SHA multi-deployment collision that the heuristic below mis-correlates
 * or silently drops (EF promotes dev/tst/stg from one SHA in minutes).
 *
 * FALLBACK (legacy heuristic): if no deployment-status link exists for this run (e.g. an old
 * run outside the probe window, or a status with no `log_url`), match by head SHA — every
 * Deploy Version run shares `development`'s SHA — disambiguated by the deployment whose
 * creation time is closest. Returns null when no confident match exists (the lane logic then
 * falls back to the branch). Nothing regresses: pre-index behavior is preserved when unlinked.
 */
function resolveRunEnvironment(
  run: GitHubWorkflowRunApi,
  deployments: readonly RepoDeployment[],
  runEnvIndex: DeploymentRunEnvironmentIndex
): DeployEnvironmentKey | null {
  const linked = runEnvIndex.get(run.id);
  if (linked) return linked;

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
  const [workflowFetches, deployments] = await Promise.all([
    Promise.all(workflowIds.map((id) => fetchWorkflowRunsById(token, owner, repo, id))),
    fetchRepoDeployments(token, owner, repo),
  ]);

  // Build the authoritative deployment→run env index (skip P2P: its on-prem deployment envs
  // cannot separate tst/stg, so its dedicated resolver owns env assignment instead).
  const runEnvIndex: DeploymentRunEnvironmentIndex = isP2pGoServiceRepo(repo)
    ? new Map()
    : await buildDeploymentRunEnvironmentIndex(token, owner, repo, deployments);

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

  // Active-run env visibility (#2): a queued/in_progress Deploy Version run lands on its
  // correct env row as soon as its deployment exists — the deployment's first status
  // (`waiting`/`queued`) already carries the `log_url`, so `runEnvIndex` resolves it. There is
  // a brief race before the deployment is created (e.g. a run still `queued` for a runner with
  // no deployment yet): such a run resolves to null and falls back to the branch, which is
  // always `development`, so it cannot be pinned to tst/stg/prd. Fully closing that window
  // requires the run NAME to carry the target env (e.g. "Deploy Version — stg"), which is an
  // app-repo workflow change (out of scope here); flagged in the PR report.
  const activeEntry = runs.find(({ run }) => run.status === 'in_progress')
    ?? runs.find(({ run }) => isQueuedLikeStatus(run.status))
    ?? runs.find(({ run }) => run.status !== 'completed');
  const lastDoneEntry = runs.find(({ run }) => run.status === 'completed');

  return {
    ...base,
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
