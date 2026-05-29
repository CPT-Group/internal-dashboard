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
}

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
}
