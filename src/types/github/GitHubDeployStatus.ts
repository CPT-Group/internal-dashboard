/** One row per monitored deploy workflow (from GET /api/github/deploy-status). */
export interface GitHubDeployWorkflowStatus {
  owner: string;
  repo: string;
  workflowId: number;
  /** Short label for the TV (e.g. azure-functions-api). */
  shortLabel: string;
  error?: string;
  /** Latest run that is not completed (queued, in_progress, waiting, etc.), if any. */
  activeRun?: GitHubDeployRunSummary;
  /** Most recent completed run when nothing is active. */
  lastCompletedRun?: GitHubDeployRunSummary;
  /** Recent runs for timeline/history widgets (newest first). */
  recentRuns?: GitHubDeployRunSummary[];
}

export interface GitHubDeployRunSummary {
  id: number;
  status: string;
  conclusion: string | null;
  headBranch: string | null;
  title: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}
