import {
  GITHUB_DEPLOY_WORKFLOW_MONITORS,
  isPlaceholderDeployMonitor,
  type GitHubDeployLiveWorkflowMonitor,
  type GitHubDeployPlaceholderMonitor,
} from '@/constants/GITHUB_DEPLOY_MONITORS';
import { getDedicatedWorkflowIdsForDevTstLane } from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';
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
 * Fetch the repo's recent GitHub Deployments. Each deployment records the env-gated job's
 * `environment` (dev/tst/stg/prd) — the only API source of a Deploy Version run's TARGET env,
 * since the workflow-run object never exposes it and the branch is always `development`.
 */
async function fetchRepoDeployments(token: string, owner: string, repo: string): Promise<RepoDeployment[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/deployments?per_page=100`;
  const diagKey = `${owner}/${repo}`;
  try {
    const res = await fetch(url, { headers: githubHeaders(token), cache: 'no-store' });
    if (!res.ok) {
      // Do NOT swallow silently: a 403/404 here (token lacks Deployments: read) would empty every
      // stg/prod lane snapshot with no visible error. Record it so /api/github/deploy-status surfaces it.
      lastDeploymentsFetchDiag.set(diagKey, { ok: false, status: res.status, count: 0 });
      return [];
    }
    const data = (await res.json()) as Array<{
      id?: number | null;
      environment?: string | null;
      sha?: string | null;
      created_at?: string | null;
    }>;
    if (!Array.isArray(data)) {
      lastDeploymentsFetchDiag.set(diagKey, { ok: false, status: res.status, count: 0 });
      return [];
    }
    const out: RepoDeployment[] = [];
    for (const d of data) {
      const env = normalizeDeployEnvironment(d.environment);
      const createdAtMs = Date.parse(d.created_at ?? '');
      if (typeof d.id === 'number' && env && d.sha && Number.isFinite(createdAtMs)) {
        out.push({ id: d.id, environment: env, sha: d.sha, createdAtMs });
      }
    }
    lastDeploymentsFetchDiag.set(diagKey, { ok: true, status: res.status, count: out.length });
    return out;
  } catch {
    lastDeploymentsFetchDiag.set(diagKey, { ok: false, status: -1, count: 0 });
    return [];
  }
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

interface FetchedRunEntry {
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

const DEV_TST_SNAPSHOT_LANES: readonly ('dev' | 'tst')[] = ['dev', 'tst'];

/**
 * Build dev/tst lane snapshots from each lane's DEDICATED workflow's latest run (Dev Fast / TST
 * Build), matched by workflow id — never by branch (Deploy Version & TST Build both run on
 * `development`) and never by env-resolution (TST Build creates no env-gated deployment), and
 * deliberately EXCLUDING the Deploy Version promoter (which targets stg/prd, not the Tst lane).
 * This is why EF's TST lane now shows the real TST Build FAIL instead of N/A.
 */
function buildRunBasedLaneSnapshots(
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
    const entry = latestRunForWorkflowIds(runs, workflowIds);
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

  // Stg/prod lane pills come from buildDeploymentLaneSnapshots — the latest deployment per env plus
  // its status (2 probes/repo). We deliberately DO NOT build the 40-per-repo deployment→run env
  // index anymore: at ~240 GitHub calls/refresh (40 × 6 repos) it exhausted the token's hourly
  // budget within minutes, then 403-rate-limited the Deployments API — and fetchRepoDeployments
  // silently returned [] on the 403, emptying every stg/prod snapshot into a false "N/A" (the
  // 2026-06-30 regression). The index only labeled recentRuns; those now fall back to the SHA+time
  // heuristic over the already-fetched deployments list (no extra calls). Accurate lane state comes
  // from the snapshots, not the index.
  const runEnvIndex: DeploymentRunEnvironmentIndex = new Map();
  const deploymentLaneSnapshots = await buildDeploymentLaneSnapshots(
    token,
    owner,
    repo,
    deployments,
    deploymentLaneEnvsForRepo(repo)
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

  // dev/tst lanes ← dedicated-workflow latest run; stg/prod lanes ← Deployments API (above).
  // Deployment-based snapshots win on conflict, but dev/tst and stg/prod never collide.
  const laneSnapshots: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>> = reclassifyCancelledLaneSnapshots(
    {
      ...buildRunBasedLaneSnapshots(repo, runs),
      ...deploymentLaneSnapshots,
    },
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
