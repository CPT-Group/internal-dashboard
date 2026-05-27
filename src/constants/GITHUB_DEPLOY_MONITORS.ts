/**
 * CD workflows to show on the deploy-status panel (IDs from `gh workflow list -R owner/repo`).
 * Each live entry is the primary deploy pipeline for that repository.
 */

export interface GitHubDeployLiveWorkflowMonitor {
  owner: string;
  repo: string;
  workflowId: number;
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
    /** `CD - Deploy Azure Functions` */
    workflowId: 235954278,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-internal-tools',
    /** `CD - Deploy to Azure Static Web Apps` */
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
    /** `CD - Run EF Core Migrations` */
    workflowId: 236316341,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-infra',
    /** `Terraform apply` */
    workflowId: 283599098,
  },
  {
    owner: 'CPT-Group',
    repo: 'coming-soon',
    placeholder: true,
    shortLabel: 'Coming soon',
  },
] as const;

/** Monitors that call the GitHub Actions API (excludes TV placeholder slots). */
export const LIVE_DEPLOY_WORKFLOW_MONITORS: readonly GitHubDeployLiveWorkflowMonitor[] =
  GITHUB_DEPLOY_WORKFLOW_MONITORS.filter(isLiveDeployMonitor);
