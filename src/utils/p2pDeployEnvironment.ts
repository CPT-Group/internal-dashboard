import type { DeployEnvironmentKey } from '@/utils/githubDeployEnvironment';

export const P2P_GO_SERVICE_REPO = 'cpt-group-p2p-go-service';
export const P2P_DEV_FAST_WORKFLOW_ID = 301145195;
/** Deploy Version — promotes tst/stg/prd via workflow_dispatch on `development`. */
export const P2P_PROMOTE_WORKFLOW_ID = 301718891;
/** TST Build Artifact — production-bound image from test SHA (NOVA-3126). */
export const P2P_TST_BUILD_WORKFLOW_ID = 301718895;

const PROMOTE_LANE_ORDER: readonly DeployEnvironmentKey[] = ['tst', 'stg', 'prod'];

/** Prior promote runs within this window count as the same burst (same SHA on `development`). */
const PROMOTE_WAVE_MS = 10 * 60 * 1000;

const DEPLOYMENT_CORRELATION_WINDOW_MS = 45 * 60 * 1000;

export interface P2pDeploymentHint {
  environment: DeployEnvironmentKey;
  sha: string;
  createdAtMs: number;
}

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

function countPriorPromotesInWave(
  run: P2pRunEnvironmentInput,
  allRuns: readonly P2pRunEnvironmentInput[]
): number | null {
  const headSha = run.headSha?.trim() ?? '';
  const runMs = Date.parse(run.createdAt);
  if (!headSha || !Number.isFinite(runMs)) {
    return null;
  }
  const shaKey = headSha.slice(0, 12);

  return allRuns.filter((candidate) => {
    if (candidate.workflowId !== P2P_PROMOTE_WORKFLOW_ID) return false;
    const candidateSha = candidate.headSha?.trim().slice(0, 12) ?? '';
    if (candidateSha !== shaKey) return false;
    const candidateMs = Date.parse(candidate.createdAt);
    if (!Number.isFinite(candidateMs) || candidateMs >= runMs) return false;
    if (runMs - candidateMs > PROMOTE_WAVE_MS) return false;
    return candidate.status === 'completed' && candidate.conclusion === 'success';
  }).length;
}

function promoteTargetFromDeploymentHints(
  run: P2pRunEnvironmentInput,
  deployments: readonly P2pDeploymentHint[]
): DeployEnvironmentKey | null {
  const headSha = run.headSha?.trim() ?? '';
  const runMs = Date.parse(run.createdAt);
  if (!headSha || !Number.isFinite(runMs) || deployments.length === 0) {
    return null;
  }
  const shaKey = headSha.slice(0, 12);

  let best: P2pDeploymentHint | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const d of deployments) {
    if (d.sha.slice(0, 12) !== shaKey) continue;
    const delta = Math.abs(d.createdAtMs - runMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = d;
    }
  }
  if (!best || bestDelta > DEPLOYMENT_CORRELATION_WINDOW_MS) {
    return null;
  }
  return best.environment;
}

/**
 * P2P promotes tst → stg → prd via workflow_dispatch on `development`.
 * GitHub Deployments use `onprem-nonprod` / `onprem-prd`, so branch + deployment env
 * cannot distinguish tst vs stg alone. Prod is resolved from onprem-prd deployments;
 * tst/stg use promote-order within a short time burst for the same workflow head SHA.
 */
export function resolveP2pRunEnvironment(
  run: P2pRunEnvironmentInput,
  allRuns: readonly P2pRunEnvironmentInput[],
  deployments: readonly P2pDeploymentHint[] = []
): DeployEnvironmentKey | null {
  if (run.workflowId === P2P_DEV_FAST_WORKFLOW_ID) {
    return 'dev';
  }
  if (run.workflowId === P2P_TST_BUILD_WORKFLOW_ID) {
    return 'tst';
  }
  if (run.workflowId !== P2P_PROMOTE_WORKFLOW_ID) {
    return null;
  }

  const fromDeployment = promoteTargetFromDeploymentHints(run, deployments);
  if (fromDeployment === 'prod') {
    return 'prod';
  }

  const priorInWave = countPriorPromotesInWave(run, allRuns);
  if (priorInWave === null) {
    return null;
  }

  const laneIndex = Math.min(priorInWave, PROMOTE_LANE_ORDER.length - 1);
  return PROMOTE_LANE_ORDER[laneIndex] ?? null;
}
