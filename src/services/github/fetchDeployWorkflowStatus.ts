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
  environment: DeployEnvironmentKey;
  sha: string;
  createdAtMs: number;
}

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
    const data = (await res.json()) as Array<{ environment?: string | null; sha?: string | null; created_at?: string | null }>;
    if (!Array.isArray(data)) return [];
    const out: RepoDeployment[] = [];
    for (const d of data) {
      const env = normalizeDeployEnvironment(d.environment);
      const createdAtMs = Date.parse(d.created_at ?? '');
      if (env && d.sha && Number.isFinite(createdAtMs)) {
        out.push({ environment: env, sha: d.sha, createdAtMs });
      }
    }
    return out;
  } catch {
    return [];
  }
}

const ENV_CORRELATION_WINDOW_MS = 45 * 60 * 1000;

/**
 * Resolve a run's TARGET environment by matching it to the deployment it created: same head SHA
 * (every Deploy Version run shares `development`'s SHA), disambiguated by the deployment whose
 * creation time is closest to the run's. Returns null when no confident match exists (the lane
 * logic then falls back to the branch).
 */
function resolveRunEnvironment(run: GitHubWorkflowRunApi, deployments: readonly RepoDeployment[]): DeployEnvironmentKey | null {
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
  deployments: readonly RepoDeployment[]
): DeployEnvironmentKey | null {
  if (isP2pGoServiceRepo(repo)) {
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
  return resolveRunEnvironment(run, deployments);
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

  return {
    ...base,
    queuedCount,
    inProgressCount,
    activeCount: queuedCount + inProgressCount,
    activeRun: activeEntry
      ? toSummary(
          activeEntry.run,
          activeEntry.workflowId,
          resolveEnvironmentForWorkflowRun(repo, activeEntry.run, activeEntry.workflowId, allRunEntries, deployments)
        )
      : undefined,
    lastCompletedRun: lastDoneEntry
      ? toSummary(
          lastDoneEntry.run,
          lastDoneEntry.workflowId,
          resolveEnvironmentForWorkflowRun(repo, lastDoneEntry.run, lastDoneEntry.workflowId, allRunEntries, deployments)
        )
      : undefined,
    recentRuns: runs
      .slice(0, 30)
      .map(({ run, workflowId }) =>
        toSummary(run, workflowId, resolveEnvironmentForWorkflowRun(repo, run, workflowId, allRunEntries, deployments))
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
