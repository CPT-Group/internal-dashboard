import type {
  GitHubDeployLaneSnapshot,
  GitHubDeployLaneState,
} from '@/types/github/GitHubDeployStatus';
import type { DeployEnvironmentKey, DeployLaneKey } from '@/utils/githubDeployEnvironment';

/**
 * Lane-snapshot sources (regression fix — NOVA dev-corner-two N/A regression).
 *
 * BEFORE: every lane was resolved from the truncated `recentRuns.slice(0,30)` window. EF/UI run
 * dev+tst constantly, so a real STG/PROD `Deploy Version` deploy from hours earlier fell out of
 * that window → the lane matched no run → false "N/A" even though a real deploy existed.
 *
 * AFTER: each lane is sourced from its authoritative, untruncated source:
 *  - STG/PROD  → latest GitHub Deployment for that env + its latest status (`state`). Covers the
 *               full deploy history and shows live queued→in_progress→done on the env row.
 *  - DEV/TST   → latest run of the lane's DEDICATED workflow (Dev Fast / TST Build), matched by
 *               workflow id — never by branch (Deploy Version & TST Build both run on
 *               `development`) and never by env-resolution (TST Build creates no deployment).
 *
 * A lane is only ever absent (→ rendered idle/N/A by the card) when that env/workflow has truly
 * never deployed/run. A real prior deploy NEVER collapses to N/A.
 */

/** GitHub Deployment-status `state` values we map onto lane pills. */
export type DeploymentStatusState =
  | 'success'
  | 'failure'
  | 'error'
  | 'in_progress'
  | 'queued'
  | 'pending'
  | 'waiting'
  | 'inactive'
  | string;

/**
 * Map a GitHub Deployment-status `state` to a lane pill state.
 * success → ok; failure/error → failed; in_progress → running; queued/pending/waiting → queued.
 * `inactive` (a superseded deployment) and any unknown state fall back to `idle` so we never
 * paint a misleading OK/Fail for an indeterminate status.
 */
export function laneStateFromDeploymentState(state: DeploymentStatusState | null): GitHubDeployLaneState {
  switch (state) {
    case 'success':
      return 'ok';
    case 'failure':
    case 'error':
      return 'failed';
    case 'in_progress':
      return 'running';
    case 'queued':
    case 'pending':
    case 'waiting':
      return 'queued';
    default:
      return 'idle';
  }
}

/**
 * Map a workflow run's `status`/`conclusion` to a lane pill state (dev/tst dedicated-workflow
 * source). Non-completed runs are running/queued; completed runs are ok (success) or failed.
 */
export function laneStateFromRunStatus(
  status: string,
  conclusion: string | null
): GitHubDeployLaneState {
  if (status !== 'completed') {
    if (status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested') {
      return 'queued';
    }
    return 'running';
  }
  if (conclusion === 'success') return 'ok';
  // A deliberately-cancelled run is not a failure — render it neutral, not danger red.
  if (conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

const PULL_REQUEST_NUMBER_PATTERN = /pull request\s+#(\d+)/i;

/** PR number label (e.g. "#155") from a merge-style run title, else null. */
export function deployVersionLabelFromTitle(title: string | null): string | null {
  if (!title) return null;
  const match = title.match(PULL_REQUEST_NUMBER_PATTERN);
  if (!match?.[1]) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? `#${parsed}` : null;
}

const ENV_LANE_LABEL: Readonly<Record<DeployEnvironmentKey, string>> = {
  dev: 'Dev',
  tst: 'Tst',
  stg: 'Stg',
  prod: 'Prod',
};

export interface DeploymentLaneSnapshotInput {
  lane: DeployLaneKey;
  env: DeployEnvironmentKey;
  state: GitHubDeployLaneState;
  /** Deployment status `created_at` (most recent status row) — drives idle aging. */
  statusCreatedAt: string | null;
  /** Deployment `created_at` — when the deploy was kicked off. */
  deploymentCreatedAt: string | null;
  /** Originating Actions run link from the status `log_url`, when present. */
  logUrl: string | null;
}

/** Build a stg/prod lane snapshot from its latest deployment + latest status. */
export function buildDeploymentLaneSnapshot(
  input: DeploymentLaneSnapshotInput
): GitHubDeployLaneSnapshot {
  const updatedAt = input.statusCreatedAt ?? input.deploymentCreatedAt;
  return {
    lane: input.lane,
    state: input.state,
    createdAt: input.deploymentCreatedAt ?? input.statusCreatedAt,
    updatedAt,
    triggerText: `${ENV_LANE_LABEL[input.env]} deployment`,
    branch: null,
    deployVersionLabel: null,
    htmlUrl: input.logUrl,
  };
}

export interface RunLaneSnapshotInput {
  lane: DeployLaneKey;
  state: GitHubDeployLaneState;
  createdAt: string | null;
  updatedAt: string | null;
  title: string | null;
  branch: string | null;
  htmlUrl: string | null;
}

/** Build a dev/tst lane snapshot from the lane's dedicated-workflow latest run. */
export function buildRunLaneSnapshot(input: RunLaneSnapshotInput): GitHubDeployLaneSnapshot {
  return {
    lane: input.lane,
    state: input.state,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    triggerText: input.title,
    branch: input.branch,
    deployVersionLabel: deployVersionLabelFromTitle(input.title),
    htmlUrl: input.htmlUrl,
  };
}
