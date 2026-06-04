import { LIVE_DEPLOY_WORKFLOW_MONITORS } from '@/constants/GITHUB_DEPLOY_MONITORS';

export interface DeployMonitorProbe {
  owner: string;
  repo: string;
  workflowIds: readonly number[];
  short: string;
}

/** Workflow IDs to probe in `test-github-deploy-tokens.mjs` — derived from app monitors. */
export function getDeployMonitorProbeList(): DeployMonitorProbe[] {
  return LIVE_DEPLOY_WORKFLOW_MONITORS.map((monitor) => ({
    owner: monitor.owner,
    repo: monitor.repo,
    workflowIds: monitor.workflowIds ?? [monitor.workflowId],
    short: monitor.repo.replace(/^cpt-/, ''),
  }));
}
