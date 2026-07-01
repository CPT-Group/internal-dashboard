export type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';
export type DeployLaneKey = DeployEnvironmentKey | 'nonprod';

interface DeployLaneConfig {
  order: readonly DeployLaneKey[];
  labels: Partial<Record<DeployLaneKey, string>>;
  /**
   * Lanes that do not exist for this repo as deploy targets (e.g. a package/library repo has
   * no Stg/Prod *deploy* — it publishes). Rendered as a static "N/A" row, not idle, and never
   * matched to a run. Distinct from `idle` (a real lane with no recent run).
   */
  naLanes?: Partial<Record<DeployLaneKey, string>>;
}

const DEFAULT_LANE_CONFIG: DeployLaneConfig = {
  order: ['dev', 'tst', 'stg', 'prod'],
  labels: {
    dev: 'Dev',
    tst: 'Tst',
    stg: 'Stg',
    prod: 'Prod',
  },
};

const NUGET_LANE_CONFIG: DeployLaneConfig = {
  order: ['nonprod', 'prod'],
  labels: {
    nonprod: 'Non-Prod',
    prod: 'Prod',
  },
};

/**
 * cpt-nuget-libraries is a PACKAGE repo: it builds/tests on Dev and Tst then publishes — it has
 * no Stg or Prod *deploy* lane. Show Stg/Prod as "N/A — package repo" instead of mapping Prod to
 * a report-only stub workflow or rendering an empty idle row for a non-existent Stg lane.
 */
const NUGET_LIBRARIES_LANE_CONFIG: DeployLaneConfig = {
  order: ['dev', 'tst', 'stg', 'prod'],
  labels: {
    dev: 'Dev',
    tst: 'Tst',
    stg: 'Stg',
    prod: 'Prod',
  },
  naLanes: {
    stg: 'N/A — package repo',
    prod: 'N/A — package repo',
  },
};

export interface DeployRunEnvironmentInput {
  headBranch: string | null;
  title: string | null;
  /** Deployments-API target env, when resolved. Takes precedence over branch. */
  resolvedEnvironment?: DeployEnvironmentKey | null;
}

function normalizeBranchName(branch: string | null): string {
  if (!branch) return '';
  return branch.trim().toLowerCase().replace(/^refs\/heads\//, '');
}

function isNugetLibrariesRepo(repo: string): boolean {
  return repo.toLowerCase() === 'cpt-nuget-libraries';
}

function isNonProdProdLaneRepo(repo: string): boolean {
  return repo.toLowerCase() === 'npm-libs';
}

/** Exact Git branch names per TV swim lane (CPT CD repos). */
export const DEPLOY_ENV_BRANCHES: Readonly<Record<DeployEnvironmentKey, readonly string[]>> = {
  dev: ['development'],
  tst: ['test'],
  stg: ['staging'],
  prod: ['production', 'main'],
};

/**
 * Normalize a GitHub Deployments-API environment name to a lane key.
 * The deploy workflows use `environment: name: dev|tst|stg|prd`; we map `prd` → `prod`.
 */
export function normalizeDeployEnvironment(env: string | null | undefined): DeployEnvironmentKey | null {
  const key = (env ?? '').trim().toLowerCase();
  if (key === 'dev' || key === 'development') return 'dev';
  if (key === 'tst' || key === 'test') return 'tst';
  if (key === 'stg' || key === 'staging') return 'stg';
  if (key === 'prd' || key === 'prod' || key === 'production') return 'prod';
  if (key === 'onprem-prd') return 'prod';
  // P2P (on-prem Go service) has no distinct stg env — `onprem-nonprod` IS its pre-prod deploy
  // target. Map it to the stg lane so the board shows p2p's real nonprod deploy instead of N/A.
  // Safe for the p2p run resolver: it only acts on `prod` hints; a prod run still matches its own
  // onprem-prd deployment as closest, and non-prod hints fall through to the promote-wave logic.
  if (key === 'onprem-nonprod') return 'stg';
  return null;
}

/**
 * Resolve deployment environment from GitHub `head_branch` only — exact branch match.
 * Feature/PR branches are ignored (not in DEPLOY_ENV_BRANCHES).
 */
export function detectDeployEnvironmentFromBranch(branch: string | null): DeployEnvironmentKey | null {
  const normalized = normalizeBranchName(branch);
  if (!normalized) return null;

  for (const env of ['dev', 'tst', 'stg', 'prod'] as const) {
    if (DEPLOY_ENV_BRANCHES[env].includes(normalized)) {
      return env;
    }
  }

  return null;
}

/**
 * Prefer the Deployments-API resolved environment (Deploy Version runs all share
 * `headBranch === 'development'`); fall back to exact branch match for legacy
 * branch-triggered deploys. Run titles are not used.
 */
export function detectDeployEnvironmentFromRun(input: DeployRunEnvironmentInput): DeployEnvironmentKey | null {
  if (input.resolvedEnvironment) return input.resolvedEnvironment;
  return detectDeployEnvironmentFromBranch(input.headBranch);
}

export function getDeployLaneConfig(repo: string): DeployLaneConfig {
  if (isNonProdProdLaneRepo(repo)) return NUGET_LANE_CONFIG;
  if (isNugetLibrariesRepo(repo)) return NUGET_LIBRARIES_LANE_CONFIG;
  return DEFAULT_LANE_CONFIG;
}

/** Label for a package-repo N/A lane, or null when the lane is a real deploy target. */
export function getNaLaneLabel(repo: string, lane: DeployLaneKey): string | null {
  return getDeployLaneConfig(repo).naLanes?.[lane] ?? null;
}

export function mapEnvironmentToLane(repo: string, env: DeployEnvironmentKey): DeployLaneKey {
  if (isNonProdProdLaneRepo(repo) && env !== 'prod') return 'nonprod';
  return env;
}

/** Branches that belong to a swim lane for the given repo. */
export function getBranchesForDeployLane(repo: string, lane: DeployLaneKey): readonly string[] {
  if (isNonProdProdLaneRepo(repo)) {
    if (lane === 'prod') return DEPLOY_ENV_BRANCHES.prod;
    if (lane === 'nonprod') {
      return [...DEPLOY_ENV_BRANCHES.dev, ...DEPLOY_ENV_BRANCHES.tst, ...DEPLOY_ENV_BRANCHES.stg];
    }
    return [];
  }
  if (isNugetLibrariesRepo(repo)) {
    if (lane === 'dev') return DEPLOY_ENV_BRANCHES.dev;
    // NOVA-3118: TST Build is dispatched from `development` after auto-merge (head_branch is not `test`).
    if (lane === 'tst') return [...DEPLOY_ENV_BRANCHES.tst, ...DEPLOY_ENV_BRANCHES.dev];
    if (lane === 'stg') return DEPLOY_ENV_BRANCHES.stg;
    // Deploy Version is workflow_dispatch on `development` (report-only today).
    if (lane === 'prod') return [...DEPLOY_ENV_BRANCHES.prod, ...DEPLOY_ENV_BRANCHES.dev];
    return [];
  }
  if (lane === 'dev') return DEPLOY_ENV_BRANCHES.dev;
  if (lane === 'tst') return DEPLOY_ENV_BRANCHES.tst;
  if (lane === 'stg') return DEPLOY_ENV_BRANCHES.stg;
  if (lane === 'prod') return DEPLOY_ENV_BRANCHES.prod;
  return [];
}

export interface DeployRunLike {
  headBranch: string | null;
  updatedAt: string;
  workflowId?: number;
  status?: string;
  /** Deployments-API target env; when set, lane matching uses it instead of the branch. */
  resolvedEnvironment?: DeployEnvironmentKey | null;
}

/**
 * Does this run belong to `lane`? Prefer the Deployments-API resolved env (Deploy Version
 * runs are all on `development`), else fall back to the lane's allowed branches.
 */
function runMatchesDeployLane(
  run: DeployRunLike,
  repo: string,
  lane: DeployLaneKey,
  allowedBranches: ReadonlySet<string>
): boolean {
  if (run.resolvedEnvironment) {
    return mapEnvironmentToLane(repo, run.resolvedEnvironment) === lane;
  }
  return allowedBranches.has(normalizeBranchName(run.headBranch));
}

export interface DeployLaneRunSelection {
  primaryWorkflowIds: readonly number[] | null;
  activeWorkflowIds: readonly number[] | null;
}

export function isWithinDeployIdleWindow(
  isoTimestamp: string,
  nowMs: number = Date.now(),
  idleAfterDays: number = 7
): boolean {
  const updatedAtMs = Date.parse(isoTimestamp);
  if (!Number.isFinite(updatedAtMs)) return false;
  const idleAfterMs = idleAfterDays * 24 * 60 * 60 * 1000;
  return nowMs - updatedAtMs <= idleAfterMs;
}

function latestRunByFilters<T extends DeployRunLike>(
  runs: readonly T[],
  repo: string,
  lane: DeployLaneKey,
  allowedBranches: ReadonlySet<string>,
  allowedWorkflows: ReadonlySet<number> | null,
  requireActiveStatus: boolean
): T | undefined {
  let latest: T | undefined;
  let latestMs = Number.NEGATIVE_INFINITY;

  for (const run of runs) {
    if (!runMatchesDeployLane(run, repo, lane, allowedBranches)) continue;
    if (allowedWorkflows && (run.workflowId === undefined || !allowedWorkflows.has(run.workflowId))) continue;
    if (requireActiveStatus && run.status === 'completed') continue;

    const ms = Date.parse(run.updatedAt);
    if (!Number.isFinite(ms) || ms < latestMs) continue;
    latestMs = ms;
    latest = run;
  }

  return latest;
}

/** Newest lane run with active-first priority, then completed primary workflow fallback. */
export function findLatestRunForDeployLane<T extends DeployRunLike>(
  repo: string,
  lane: DeployLaneKey,
  runs: readonly T[],
  selection: DeployLaneRunSelection
): T | undefined {
  const allowedBranches = new Set(getBranchesForDeployLane(repo, lane));
  if (allowedBranches.size === 0) return undefined;

  const activeWorkflowIds = selection.activeWorkflowIds;
  const primaryWorkflowIds = selection.primaryWorkflowIds;
  const allowedActiveWorkflows =
    activeWorkflowIds && activeWorkflowIds.length > 0 ? new Set(activeWorkflowIds) : null;
  const allowedPrimaryWorkflows =
    primaryWorkflowIds && primaryWorkflowIds.length > 0 ? new Set(primaryWorkflowIds) : null;

  const activeRun = latestRunByFilters(
    runs,
    repo,
    lane,
    allowedBranches,
    allowedActiveWorkflows,
    true
  );
  if (activeRun) return activeRun;

  return latestRunByFilters(
    runs,
    repo,
    lane,
    allowedBranches,
    allowedPrimaryWorkflows,
    false
  );
}
