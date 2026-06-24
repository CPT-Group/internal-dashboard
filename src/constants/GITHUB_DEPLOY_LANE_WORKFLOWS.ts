import type { DeployLaneKey } from '@/utils/githubDeployEnvironment';

export interface LaneWorkflowRule {
  /** Completed-state priority list for this lane. */
  primary: readonly number[];
  /** Optional active-state list (`status !== completed`) for this lane. */
  active?: readonly number[];
}

type RepoLaneWorkflowRules = Partial<Record<DeployLaneKey, LaneWorkflowRule>>;

/**
 * Standardized deploy repos with Dev Fast + TST Build + Deploy Version model.
 * IDs verified with `gh workflow list -R CPT-Group/<repo>` on 2026-06-01.
 */
export const DEPLOY_LANE_WORKFLOW_RULES: Readonly<Record<string, RepoLaneWorkflowRules>> = {
  'cpt-azure-functions-api': {
    dev: { primary: [285805316], active: [285805316, 285805315] },
    tst: { primary: [285805319, 285805315] },
    stg: { primary: [285805315] },
    prod: { primary: [285805315] },
  },
  'cpt-ef-postgres-migrations': {
    dev: { primary: [285810378], active: [285810378, 285810377] },
    tst: { primary: [285810381, 285810377] },
    stg: { primary: [285810377] },
    prod: { primary: [285810377] },
  },
  'cpt-internal-tools': {
    dev: { primary: [285829490], active: [285829490, 285829489] },
    tst: { primary: [285829491, 285829489] },
    stg: { primary: [285829489] },
    prod: { primary: [285829489] },
  },
  /** Dev / Tst / report-only Prod — NOVA-3118 auto-merge + TST dispatch model. IDs verified 2026-06-24. */
  'cpt-nuget-libraries': {
    dev: { primary: [288752702], active: [288752702] },
    tst: { primary: [288752705], active: [288752705, 301162091] },
    prod: { primary: [288752700] },
  },
  /** Dev Fast + per-env promote workflow_dispatch (all on `development`). IDs verified 2026-06-24. */
  'cpt-group-p2p-go-service': {
    dev: { primary: [301145195], active: [301145195] },
    tst: { primary: [289926293], active: [289926293] },
    stg: { primary: [289926293], active: [289926293] },
    prod: { primary: [289926293], active: [289926293] },
  },
};

function unique(values: readonly number[]): readonly number[] {
  return [...new Set(values)];
}

export function getPrimaryWorkflowIdsForDeployLane(
  repo: string,
  lane: DeployLaneKey
): readonly number[] | null {
  const rule = DEPLOY_LANE_WORKFLOW_RULES[repo]?.[lane];
  if (!rule) return null;
  return rule.primary;
}

export function getActiveWorkflowIdsForDeployLane(
  repo: string,
  lane: DeployLaneKey
): readonly number[] | null {
  const rule = DEPLOY_LANE_WORKFLOW_RULES[repo]?.[lane];
  if (!rule) return null;
  return rule.active ?? rule.primary;
}

/** Union of all workflow IDs this repo should fetch for lane assignment. */
export function getMonitorWorkflowIds(repo: string): readonly number[] | null {
  const rules = DEPLOY_LANE_WORKFLOW_RULES[repo];
  if (rules) {
    const ids: number[] = [];
    for (const lane of Object.keys(rules) as DeployLaneKey[]) {
      const laneRule = rules[lane];
      if (!laneRule) continue;
      ids.push(...laneRule.primary);
      if (laneRule.active) ids.push(...laneRule.active);
    }
    return unique(ids);
  }
  return null;
}
