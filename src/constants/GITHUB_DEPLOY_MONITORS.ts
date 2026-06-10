/**
 * CD workflows to show on the deploy-status panel (IDs from `gh workflow list -R owner/repo`).
 * Each live entry is the primary deploy pipeline for that repository.
 */
import { getMonitorWorkflowIds } from '@/constants/GITHUB_DEPLOY_LANE_WORKFLOWS';

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
    /** Standardized lanes: Dev Fast, TST Build, Deploy Version. */
    workflowId: 285805316,
    workflowIds: getMonitorWorkflowIds('cpt-azure-functions-api') ?? undefined,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-internal-tools',
    /** Standardized lanes: Dev Fast, TST Build, Deploy Version. */
    workflowId: 285829490,
    workflowIds: getMonitorWorkflowIds('cpt-internal-tools') ?? undefined,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-nuget-libraries',
    /** Standardized lanes: Dev Fast, TST Build, Deploy Version (replaced deleted `CD - Publish NuGet Packages`). */
    workflowId: 288752702,
    workflowIds: getMonitorWorkflowIds('cpt-nuget-libraries') ?? undefined,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-ef-postgres-migrations',
    /** Standardized lanes: Dev Fast, TST Build, Deploy Version. */
    workflowId: 285810378,
    workflowIds: getMonitorWorkflowIds('cpt-ef-postgres-migrations') ?? undefined,
  },
  {
    owner: 'CPT-Group',
    repo: 'cpt-group-p2p-go-service',
    /** `CD - Build & Deploy to On-Prem` */
    workflowId: 289926293,
    workflowIds: getMonitorWorkflowIds('cpt-group-p2p-go-service') ?? undefined,
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
