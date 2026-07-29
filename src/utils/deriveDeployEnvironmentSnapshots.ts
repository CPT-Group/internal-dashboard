import type {
  GitHubDeployLaneSnapshot,
  GitHubDeployRunSummary,
  GitHubDeployWorkflowStatus,
} from '@/types/github/GitHubDeployStatus';
import {
  formatDeployVersionLabel,
  type DeployLaneSnapshotState,
} from '@/utils/githubDeployDisplay';
import {
  findLatestRunForDeployLane,
  getDeployLaneConfig,
  getNaLaneLabel,
  isWithinDeployIdleWindow,
  type DeployLaneKey,
} from '@/utils/githubDeployEnvironment';
import {
  getActiveWorkflowIdsForDeployLane,
  getPrimaryWorkflowIdsForDeployLane,
} from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';

export type EnvironmentRunState = DeployLaneSnapshotState;
const IDLE_AFTER_DAYS = 7;

export interface EnvironmentSnapshot {
  key: DeployLaneKey;
  label: string;
  state: EnvironmentRunState;
  branch: string | null;
  triggerText: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** PR # from merge title when present. */
  deployVersionLabel: string | null;
}

function environmentSnapshotFromRun(
  env: DeployLaneKey,
  label: string,
  state: EnvironmentRunState,
  run: GitHubDeployRunSummary
): EnvironmentSnapshot {
  return {
    key: env,
    label,
    state,
    branch: run.headBranch,
    triggerText: run.title,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    deployVersionLabel: formatDeployVersionLabel(run),
  };
}

function isQueuedLikeRunStatus(status: string): boolean {
  return status === 'queued' || status === 'waiting' || status === 'pending' || status === 'requested';
}

function isDeploymentsSourcedLane(lane: DeployLaneKey): boolean {
  return lane === 'stg' || lane === 'prod';
}

function runStateFromSummary(run: GitHubDeployRunSummary): EnvironmentRunState {
  if (run.status !== 'completed') {
    return isQueuedLikeRunStatus(run.status) ? 'queued' : 'running';
  }
  if (run.conclusion === 'success') return 'ok';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

/**
 * Build a lane row from the server-computed lane snapshot (the authoritative, full-history
 * source — Deployments API for stg/prod, dedicated workflow run for dev/tst). Anything older
 * than the idle window ages to "idle"; a real prior deploy NEVER renders as N/A.
 */
function snapshotToEnvironmentSnapshot(
  lane: DeployLaneKey,
  label: string,
  snapshot: GitHubDeployLaneSnapshot
): EnvironmentSnapshot {
  const updatedAt = snapshot.updatedAt ?? snapshot.createdAt;
  const isActive = snapshot.state === 'running' || snapshot.state === 'queued';
  // Active deploys are never aged out; completed ones age to idle past the window.
  if (!isActive && (!updatedAt || !isWithinDeployIdleWindow(updatedAt, Date.now(), IDLE_AFTER_DAYS))) {
    return {
      key: lane,
      label,
      state: 'idle',
      branch: null,
      triggerText: null,
      createdAt: null,
      updatedAt,
      deployVersionLabel: null,
    };
  }
  return {
    key: lane,
    label,
    state: snapshot.state,
    branch: snapshot.branch,
    triggerText: snapshot.triggerText,
    createdAt: snapshot.createdAt,
    updatedAt,
    deployVersionLabel: snapshot.deployVersionLabel,
  };
}

/**
 * Per-lane rows for a deploy card / KPI meter. N/A is package/npm libs only; Deployments API
 * failure on Stg/Prod → `api_error` (API ERR), never N/A.
 */
export function deriveEnvironmentSnapshots(row: GitHubDeployWorkflowStatus): EnvironmentSnapshot[] {
  const laneConfig = getDeployLaneConfig(row.repo);
  const runs = row.recentRuns ?? [];
  const laneSnapshots = row.laneSnapshots ?? {};
  const deploymentsFailed = row.deploymentsDiag?.ok === false;
  const deploymentsStatus = row.deploymentsDiag?.status;

  return laneConfig.order.map((lane) => {
    const label = laneConfig.labels[lane] ?? lane.toUpperCase();
    // Package-repo / npm-lib only — N/A means "this lane is not a deploy target", never "API empty".
    const naLabel = getNaLaneLabel(row.repo, lane);
    if (naLabel) {
      return {
        key: lane,
        label,
        state: 'na',
        branch: null,
        triggerText: naLabel,
        createdAt: null,
        updatedAt: null,
        deployVersionLabel: null,
      };
    }
    const snapshot = laneSnapshots[lane];
    if (snapshot) {
      return snapshotToEnvironmentSnapshot(lane, label, snapshot);
    }
    // Stg/Prod with a failed Deployments API fetch and no overlay/snapshot → API ERR, never N/A.
    if (deploymentsFailed && isDeploymentsSourcedLane(lane)) {
      return {
        key: lane,
        label,
        state: 'api_error',
        branch: null,
        triggerText:
          typeof deploymentsStatus === 'number' && deploymentsStatus > 0
            ? `Deployments API ${deploymentsStatus}`
            : 'Deployments API error',
        createdAt: null,
        updatedAt: null,
        deployVersionLabel: null,
      };
    }
    const run = findLatestRunForDeployLane(row.repo, lane, runs, {
      primaryWorkflowIds: getPrimaryWorkflowIdsForDeployLane(row.repo, lane),
      activeWorkflowIds: getActiveWorkflowIdsForDeployLane(row.repo, lane),
    });
    if (!run || !isWithinDeployIdleWindow(run.updatedAt, Date.now(), IDLE_AFTER_DAYS)) {
      return {
        key: lane,
        label,
        state: 'idle',
        branch: null,
        triggerText: null,
        createdAt: null,
        updatedAt: run?.updatedAt ?? null,
        deployVersionLabel: null,
      };
    }
    return environmentSnapshotFromRun(lane, label, runStateFromSummary(run), run);
  });
}
