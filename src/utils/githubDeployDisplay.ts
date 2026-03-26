import type { GitHubDeployRunSummary, GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

export function formatDeployStatusLabel(status: string, conclusion: string | null): string {
  if (status !== 'completed') {
    return status.replace(/_/g, ' ');
  }
  return conclusion?.replace(/_/g, ' ') ?? 'completed';
}

export type DeploySummaryCounts = { ok: number; active: number; attention: number };

/** Buckets all four monitored repos for MeterGroup (max total = number of repos). */
export function summarizeDeployRepos(repos: GitHubDeployWorkflowStatus[]): DeploySummaryCounts {
  let ok = 0;
  let active = 0;
  let attention = 0;

  for (const row of repos) {
    if (row.error) {
      attention++;
      continue;
    }
    if (row.activeRun) {
      active++;
      continue;
    }
    const r = row.lastCompletedRun;
    if (!r) {
      attention++;
      continue;
    }
    if (r.conclusion === 'success') {
      ok++;
    } else {
      attention++;
    }
  }

  return { ok, active, attention };
}

export function tagSeverityForRow(
  row: GitHubDeployWorkflowStatus,
  run: GitHubDeployRunSummary | undefined
): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
  if (row.error) {
    return 'danger';
  }
  if (!run) {
    return 'secondary';
  }
  if (run.status !== 'completed') {
    return 'warning';
  }
  if (run.conclusion === 'success') {
    return 'success';
  }
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
    return 'danger';
  }
  return 'secondary';
}

export type DeployCardHealth = 'ok' | 'warning' | 'error';

export function cardHealthForRow(
  row: GitHubDeployWorkflowStatus,
  run: GitHubDeployRunSummary | undefined
): DeployCardHealth {
  if (row.error) return 'error';
  if (!run) return 'warning';
  if (run.status !== 'completed') return 'warning';
  if (run.conclusion === 'success') return 'ok';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'error';
  return 'warning';
}

/** Subtle Recent-actions card glow: pass (green), fail (red), in-flight, or neutral (cancelled/skipped/etc.). */
export type DeployRunOutcomeGlow = 'success' | 'failure' | 'running' | 'neutral';

export function deployRunOutcomeGlow(run: GitHubDeployRunSummary): DeployRunOutcomeGlow {
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failure';
  return 'neutral';
}

export type GitHubRepoTone = 'api' | 'tools' | 'nuget' | 'migrations' | 'default';

/** Maps monitored repo names (full or short labels) to a theme color tone. */
export function repoToneForRepo(repo: string): GitHubRepoTone {
  const key = repo.toLowerCase();
  if (key.includes('azure-functions-api') || key.includes('functions')) return 'api';
  if (key.includes('internal-tools') || key.includes('tools')) return 'tools';
  if (key.includes('nuget-libraries') || key.includes('nuget')) return 'nuget';
  if (key.includes('ef-postgres-migrations') || key.includes('migration')) return 'migrations';
  return 'default';
}
