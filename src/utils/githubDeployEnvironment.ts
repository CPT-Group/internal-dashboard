export type DeployEnvironmentKey = 'dev' | 'tst' | 'stg' | 'prod';
export type DeployLaneKey = DeployEnvironmentKey;

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

/**
 * PACKAGE-LIBRARY repos (cpt-nuget-libraries; and npm package libraries when a real repo exists)
 * publish to ONE registry with SemVer version discipline — `development` → a PRERELEASE version
 * (`<base>-development.<run>.<sha>`), `test` → the STABLE/official RELEASE version that
 * staging/production app builds consume. `staging`/`production` branches exist for parity but NEVER
 * publish (deploy-version is report-only). There is NO per-env package deploy BY DESIGN: the one
 * immutable package is consumed identically by every consumer env, and the real gate is each
 * consuming app's own dev→tst→stg→prd pipeline. So the honest board is a 2-lane card labelled by
 * what the lanes ARE — Prerelease / Release — the same for every package library (nuget and npm).
 */
const PACKAGE_LIB_LANE_CONFIG: DeployLaneConfig = {
  order: ['dev', 'tst'],
  labels: {
    dev: 'Prerelease',
    tst: 'Release',
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

/** Package-library repos — cpt-nuget-libraries (NuGet) + npm-libs (npm). Both publish a prerelease
 * on `development` and the official release on `test`; neither has a per-env stg/prod deploy. */
function isPackageLibraryRepo(repo: string): boolean {
  const key = repo.toLowerCase();
  return key === 'cpt-nuget-libraries' || key === 'npm-libs';
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
  if (isPackageLibraryRepo(repo)) return PACKAGE_LIB_LANE_CONFIG;
  return DEFAULT_LANE_CONFIG;
}

/** Label for a package-repo N/A lane, or null when the lane is a real deploy target. */
export function getNaLaneLabel(repo: string, lane: DeployLaneKey): string | null {
  return getDeployLaneConfig(repo).naLanes?.[lane] ?? null;
}

export function mapEnvironmentToLane(_repo: string, env: DeployEnvironmentKey): DeployLaneKey {
  // Env maps 1:1 to its lane for every repo (package libs only surface dev/tst; the config's
  // `order` decides which lanes render).
  return env;
}

/** Branches that belong to a swim lane for the given repo. */
export function getBranchesForDeployLane(repo: string, lane: DeployLaneKey): readonly string[] {
  if (isPackageLibraryRepo(repo)) {
    // 2-lane (Prerelease/Release). NOVA-3118: TST Build is dispatched from `development` after
    // auto-merge, so head_branch is `development`, not `test`.
    if (lane === 'dev') return DEPLOY_ENV_BRANCHES.dev;
    if (lane === 'tst') return [...DEPLOY_ENV_BRANCHES.tst, ...DEPLOY_ENV_BRANCHES.dev];
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
