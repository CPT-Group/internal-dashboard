import type { DeployLaneKey } from '@/utils/githubDeployEnvironment';

/** One row per monitored deploy workflow (from GET /api/github/deploy-status). */
export interface GitHubDeployWorkflowStatus {
  owner: string;
  repo: string;
  /** Omitted for TV placeholder slots that do not call GitHub. */
  workflowId?: number;
  /** Short label for the TV (e.g. azure-functions-api). */
  shortLabel: string;
  /** Static “Coming soon” card — no Actions API fetch. */
  isPlaceholder?: boolean;
  error?: string;
  /** Count of queued runs for this monitored workflow (waiting for runners). */
  queuedCount?: number;
  /** Count of in-progress runs for this monitored workflow. */
  inProgressCount?: number;
  /** Total active runs (queued + in-progress) for this monitored workflow. */
  activeCount?: number;
  /** Latest run that is not completed (queued, in_progress, waiting, etc.), if any. */
  activeRun?: GitHubDeployRunSummary;
  /** Most recent completed run when nothing is active. */
  lastCompletedRun?: GitHubDeployRunSummary;
  /** Recent runs for timeline/history widgets (newest first). */
  recentRuns?: GitHubDeployRunSummary[];
  /**
   * Authoritative last-known status PER LANE, sourced from full deploy history rather than the
   * truncated `recentRuns` window. STG/PROD come from the GitHub Deployments API (latest
   * deployment per env + its latest status); DEV/TST come from the lane's dedicated workflow's
   * latest run. A lane is omitted only when that env/workflow has truly never deployed/run, so
   * the card renders "idle"/"N/A" instead of a false "N/A" for a real prior deploy.
   */
  laneSnapshots?: Partial<Record<DeployLaneKey, GitHubDeployLaneSnapshot>>;
}

/**
 * Snapshot of a single deploy lane's last-known state, computed server-side from the
 * authoritative source for that lane (Deployments API for stg/prod, dedicated workflow run for
 * dev/tst). Carries everything the card needs to render the lane pill without re-deriving it
 * from `recentRuns`.
 */
export interface GitHubDeployLaneSnapshot {
  lane: DeployLaneKey;
  /** Lane pill state. `idle` = a real prior deploy older than the idle window. */
  state: GitHubDeployLaneState;
  /** ISO start time of the deploy/run (for elapsed display). */
  createdAt: string | null;
  /** ISO last-update time (drives idle aging). */
  updatedAt: string | null;
  /** Ticker / context text (run title, env label, or branch). */
  triggerText: string | null;
  /** Head branch of the originating run, when known. */
  branch: string | null;
  /** PR number label (e.g. "#155") when derivable from the run title. */
  deployVersionLabel: string | null;
  /** Link to the originating Actions run, when known. */
  htmlUrl: string | null;
}

/** Lane pill states. Mirrors the deployment-status `state` and workflow run/conclusion model. */
export type GitHubDeployLaneState = 'ok' | 'running' | 'failed' | 'queued' | 'idle';

export interface GitHubDeployRunSummary {
  id: number;
  /** GitHub Actions run number for this workflow (shown in the Actions UI as Run #N). */
  runNumber: number;
  status: string;
  conclusion: string | null;
  headBranch: string | null;
  /** Short commit SHA for the workflow run head (7 chars). */
  headShaShort: string | null;
  actorLogin: string | null;
  title: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  /** Source workflow (for per-lane Dev Fast vs main CD filtering). */
  workflowId?: number;
  /**
   * Deploy TARGET environment resolved from the GitHub Deployments API, NOT the branch.
   * Deploy Version promotes every env from `--ref development` (ci-cd-standards), so all
   * tst/stg/prd runs share `headBranch === 'development'` — the branch alone can no longer
   * tell the lanes apart. When set, lane assignment uses this instead of the branch.
   */
  resolvedEnvironment?: 'dev' | 'tst' | 'stg' | 'prod' | null;
}
