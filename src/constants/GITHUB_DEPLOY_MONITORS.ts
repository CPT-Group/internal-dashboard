/**
 * CD workflows to show on the deploy-status panel (IDs from `gh workflow list -R owner/repo`).
 * Each live entry is the primary deploy pipeline for that repository.
 */

export interface GitHubDeployLiveWorkflowMonitor {
  owner: string;
  repo: string;
  /** Primary workflow used for display labels and token probes. */
  workflowId: number;
  /** Optional additional workflows merged into the same repo card (for env-specific CD lanes). */
  workflowIds?: readonly number[];
}

export interface GitHubDeployPlaceholderMonitor {
  owner: string;
  /** Stable key for React; not fetched from GitHub. */
  repo: string;
  placeholder: true;
  /** TV card header when `shortLabel` should differ from repo slug. */
  shortLabel?: string;
}

export type GitHubDeployWorkflowMonitor =
  | GitHubDeployLiveWorkflowMonitor
  | GitHubDeployPlaceholderMonitor;

export function isLiveDeployMonitor(
  monitor: GitHubDeployWorkflowMonitor
): monitor is GitHubDeployLiveWorkflowMonitor {
  return !('placeholder' in monitor && monitor.placeholder === true);
}

export function isPlaceholderDeployMonitor(
  monitor: GitHubDeployWorkflowMonitor
): monitor is GitHubDeployPlaceholderMonitor {
  return 'placeholder' in monitor && monitor.placeholder === true;
}

export const GITHUB_DEPLOY_WORKFLOW_MONITORS: readonly GitHubDeployWorkflowMonitor[] = [
  {
    owner: 'CPT-Group',
    repo: 'cpt-azure-functions-api',
    /** Dev Fast + TST Build Artifact + Deploy Version + legacy CD — see `GITHUB_DEPLOY_LANE_WORKFLOWS`. */
    workflowId: 285805316,
    workflowIds: [285805316, 285805319, 285805315, 235954278],
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-internal-tools',
    /** `CD - Deploy to Azure Static Web Apps` — single CD for all env branches. */
    workflowId: 236281791,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-nuget-libraries',
    /** `CD - Publish NuGet Packages` */
    workflowId: 235954510,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-ef-postgres-migrations',
    /** Dev Fast + TST Build Artifact + Deploy Version + legacy CD — see `GITHUB_DEPLOY_LANE_WORKFLOWS`. */
    workflowId: 285810378,
    workflowIds: [285810378, 285810381, 285810377, 236316341],
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-infra',
    /** `CD - Deploy Infrastructure` */
    workflowId: 285242645,
  },
  {
    owner: 'CPT-Group',
    repo: 'npm-libs',
    placeholder: true,
    shortLabel: 'NPM libs',
  },
] as const;

/** Monitors that call the GitHub Actions API (excludes TV placeholder slots). */
export const LIVE_DEPLOY_WORKFLOW_MONITORS: readonly GitHubDeployLiveWorkflowMonitor[] =
  GITHUB_DEPLOY_WORKFLOW_MONITORS.filter(isLiveDeployMonitor);
