import type { GitHubDeployWorkflowMonitor } from '@/constants/GITHUB_DEPLOY_MONITORS';
import type { GitHubDeployRunSummary, GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

interface GitHubWorkflowRunApi {
  id: number;
  name: string | null;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  html_url: string;
  display_title?: string | null;
  created_at: string;
  updated_at: string;
}

interface GitHubWorkflowRunsResponse {
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

function toSummary(run: GitHubWorkflowRunApi): GitHubDeployRunSummary {
  const title =
    (run.display_title && run.display_title.trim() !== '') ? run.display_title : (run.name ?? `#${run.id}`);
  return {
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    title,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

function shortLabel(repo: string): string {
  return repo.replace(/^cpt-/, '');
}

export async function fetchDeployWorkflowStatus(
  token: string,
  monitor: GitHubDeployWorkflowMonitor
): Promise<GitHubDeployWorkflowStatus> {
  const { owner, repo, workflowId } = monitor;
  const base: GitHubDeployWorkflowStatus = {
    owner,
    repo,
    workflowId,
    shortLabel: shortLabel(repo),
  };

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=8`;

  try {
    const res = await fetch(url, {
      headers: githubHeaders(token),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ...base,
        error: `GitHub ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`,
      };
    }

    const data = (await res.json()) as GitHubWorkflowRunsResponse;
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];

    const active = runs.find((r) => r.status !== 'completed');
    const lastDone = runs.find((r) => r.status === 'completed');

    return {
      ...base,
      activeRun: active ? toSummary(active) : undefined,
      lastCompletedRun: lastDone ? toSummary(lastDone) : undefined,
      recentRuns: runs.slice(0, 6).map(toSummary),
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export async function fetchAllDeployWorkflowStatuses(
  token: string,
  monitors: readonly GitHubDeployWorkflowMonitor[]
): Promise<GitHubDeployWorkflowStatus[]> {
  return Promise.all(monitors.map((m) => fetchDeployWorkflowStatus(token, m)));
}
