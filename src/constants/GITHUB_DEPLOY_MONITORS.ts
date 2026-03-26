/**
 * CD workflows to show on the deploy-status panel (IDs from `gh workflow list -R owner/repo`).
 * Each entry is the primary deploy pipeline for that repository.
 */
export const GITHUB_DEPLOY_WORKFLOW_MONITORS = [
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
] as const;

export type GitHubDeployWorkflowMonitor = (typeof GITHUB_DEPLOY_WORKFLOW_MONITORS)[number];
