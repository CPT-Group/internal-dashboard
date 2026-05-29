import type { DeployLaneKey } from '@/utils/githubDeployEnvironment';

/**
 * Per-lane GitHub workflow allow-list (repo slug → lane → workflow database IDs).
 *
 * Standardized repos (AZF, EF migrations):
 * - **Dev** → `Dev Fast Deploy` only (fast path)
 * - **Tst** → `TST Build Artifact` (full test deploy) + legacy CD / Deploy Version fallback
 * - **Stg / Prod** → `Deploy Version` when present + legacy main CD (full deploy)
 *
 * Single-CD repos (internal-tools, nuget, infra) are not listed — all fetched runs apply.
 *
 * IDs from `gh workflow list -R CPT-Group/<repo>` (2026-05-29).
 */
export const DEPLOY_LANE_WORKFLOW_IDS: Readonly<
  Record<string, Partial<Record<DeployLaneKey, readonly number[]>>>
> = {
  'cpt-azure-functions-api': {
    dev: [285805316],
    tst: [285805319, 235954278, 285805315],
    stg: [235954278, 285805315],
    prod: [235954278, 285805315],
  },
  'cpt-ef-postgres-migrations': {
    dev: [285810378],
    tst: [285810381, 236316341, 285810377],
    stg: [236316341, 285810377],
    prod: [236316341, 285810377],
  },
};

/** All workflow IDs fetched for a repo (union of lane workflows). */
export const DEPLOY_MONITOR_WORKFLOW_IDS: Readonly<Record<string, readonly number[]>> = {
  'cpt-azure-functions-api': [285805316, 285805319, 285805315, 235954278],
  'cpt-ef-postgres-migrations': [285810378, 285810381, 285810377, 236316341],
  'cpt-internal-tools': [236281791],
  'cpt-nuget-libraries': [235954510],
  'cpt-infra': [285242645],
};

export function getWorkflowIdsForDeployLane(
  repo: string,
  lane: DeployLaneKey
): readonly number[] | null {
  const byLane = DEPLOY_LANE_WORKFLOW_IDS[repo];
  if (!byLane) return null;
  return byLane[lane] ?? null;
}
