import { differenceInMinutes, differenceInSeconds } from 'date-fns';
import type { GitHubDeployRunSummary, GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

/** Short local timestamp for deploy cards (TV-readable). */
export function formatDeployRunTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16);
  }
}

/**
 * Human-readable duration between two ISO timestamps (for run wall time).
 * When `endIsNow` is true, uses current time (in-flight elapsed).
 */
export function formatDeployRunDuration(
  createdAtIso: string,
  endAtIso: string,
  endIsNow: boolean
): string {
  const start = new Date(createdAtIso);
  const end = endIsNow ? new Date() : new Date(endAtIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—';
  const sec = differenceInSeconds(end, start);
  if (sec < 60) return `${sec}s`;
  const mins = differenceInMinutes(end, start);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
    const queued = row.queuedCount ?? 0;
    const inProgress = row.inProgressCount ?? 0;
    if (queued > 0 && inProgress === 0) {
      attention++;
      continue;
    }
    if (row.activeRun || inProgress > 0) {
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
  if ((row.queuedCount ?? 0) > 0 && (row.inProgressCount ?? 0) === 0) {
    return 'info';
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
  if ((row.queuedCount ?? 0) > 0 && (row.inProgressCount ?? 0) === 0) return 'warning';
  if (!run) return 'warning';
  if (run.status !== 'completed') return 'warning';
  if (run.conclusion === 'success') return 'ok';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'error';
  return 'warning';
}

/** Subtle Recent-actions card glow: pass (green), fail (red), in-flight, or neutral (cancelled/skipped/etc.). */
export type DeployRunOutcomeGlow = 'success' | 'failure' | 'running' | 'neutral';

/** Timeline left-column status label: semantic color (green / yellow / red / neutral). */
export type DeployTimelineOppositeKind = 'success' | 'running' | 'failure' | 'neutral';

export function deployTimelineOppositeKind(run: GitHubDeployRunSummary): DeployTimelineOppositeKind {
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success') return 'success';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failure';
  return 'neutral';
}

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
