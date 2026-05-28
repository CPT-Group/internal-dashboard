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
    /**
     * Merge both active CD pipelines for accurate lane state:
     * - `CD - Run EF Core Migrations` (test/stg/prod)
     * - `CD - Apply DEV Migrations` (dev)
     */
    workflowId: 236316341,
    workflowIds: [236316341, 283834441],
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
