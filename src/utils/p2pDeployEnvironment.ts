import type { DeployEnvironmentKey } from '@/utils/githubDeployEnvironment';

export const P2P_GO_SERVICE_REPO = 'cpt-group-p2p-go-service';
export const P2P_DEV_FAST_WORKFLOW_ID = 301145195;
export const P2P_PROMOTE_WORKFLOW_ID = 289926293;

const PROMOTE_LANE_ORDER: readonly DeployEnvironmentKey[] = ['tst', 'stg', 'prod'];

export interface P2pRunEnvironmentInput {
  workflowId: number;
  headSha: string | null | undefined;
  createdAt: string;
  status: string;
  conclusion: string | null;
}

export function isP2pGoServiceRepo(repo: string): boolean {
  return repo.toLowerCase() === P2P_GO_SERVICE_REPO;
}

/**
 * P2P promotes tst → stg → prd via workflow_dispatch on `development`.
 * GitHub Deployments use `onprem-nonprod` / `onprem-prd`, so branch + deployment env
 * cannot distinguish lanes. Infer target lane from promotion order for the same SHA:
 * 0 prior successful promote runs → tst, 1 → stg, 2+ → prod (matches predecessor guard).
 */
export function resolveP2pRunEnvironment(
  run: P2pRunEnvironmentInput,
  allRuns: readonly P2pRunEnvironmentInput[]
): DeployEnvironmentKey | null {
  if (run.workflowId === P2P_DEV_FAST_WORKFLOW_ID) {
    return 'dev';
  }
  if (run.workflowId !== P2P_PROMOTE_WORKFLOW_ID) {
    return null;
  }

  const headSha = run.headSha?.trim() ?? '';
  const runMs = Date.parse(run.createdAt);
  if (!headSha || !Number.isFinite(runMs)) {
    return null;
  }
  const shaKey = headSha.slice(0, 12);

  const priorSuccessfulPromotes = allRuns.filter((candidate) => {
    if (candidate.workflowId !== P2P_PROMOTE_WORKFLOW_ID) return false;
    const candidateSha = candidate.headSha?.trim().slice(0, 12) ?? '';
    if (candidateSha !== shaKey) return false;
    const candidateMs = Date.parse(candidate.createdAt);
    if (!Number.isFinite(candidateMs) || candidateMs >= runMs) return false;
    return candidate.status === 'completed' && candidate.conclusion === 'success';
  }).length;

  const laneIndex = Math.min(priorSuccessfulPromotes, PROMOTE_LANE_ORDER.length - 1);
  return PROMOTE_LANE_ORDER[laneIndex] ?? null;
}
