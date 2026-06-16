import { normalizeDeployEnvironment, type DeployEnvironmentKey } from '@/utils/githubDeployEnvironment';

/** TST Build Artifact workflow IDs (standardized CD repos). */
export const TST_BUILD_WORKFLOW_IDS = new Set([
  285805319, // cpt-azure-functions-api
  285810381, // cpt-ef-postgres-migrations
  285829491, // cpt-internal-tools
  288752705, // cpt-nuget-libraries
]);

/** Dev Fast Deploy workflow IDs (standardized CD repos). */
export const DEV_FAST_WORKFLOW_IDS = new Set([
  285805316,
  285810378,
  285829490,
  288752702,
]);

/** Deploy Version workflow IDs (standardized CD repos). */
export const DEPLOY_VERSION_WORKFLOW_IDS = new Set([
  285805315,
  285810377,
  285829489,
  288752700,
]);

export interface RepoDeploymentRow {
  environment: DeployEnvironmentKey;
  sha: string;
  createdAtMs: number;
}

export interface DeployRunResolveInput {
  workflowId: number;
  headBranch: string | null;
  headSha: string | null;
  createdAt: string;
  status: string;
  /** Job display names from Actions API (in-progress env hint). */
  jobNames?: readonly string[];
}

const ENV_CORRELATION_WINDOW_MS = 45 * 60 * 1000;

const JOB_ENV_PATTERN = /\((tst|stg|prd|dev|test|staging|production)\)/i;

/**
 * Parse target env from workflow job names (e.g. `Post-Deploy Health Check (stg) / …`).
 */
export function parseEnvironmentFromJobNames(jobNames: readonly string[]): DeployEnvironmentKey | null {
  for (const name of jobNames) {
    const match = name.match(JOB_ENV_PATTERN);
    if (!match?.[1]) continue;
    const env = normalizeDeployEnvironment(match[1]);
    if (env) return env;
  }
  return null;
}

/**
 * Match a workflow run to the deployment it created (same SHA, closest creation time).
 */
export function resolveEnvironmentFromDeployments(
  input: Pick<DeployRunResolveInput, 'headSha' | 'createdAt'>,
  deployments: readonly RepoDeploymentRow[]
): DeployEnvironmentKey | null {
  const headSha = input.headSha?.trim() ?? '';
  const runMs = Date.parse(input.createdAt);
  if (!headSha || !Number.isFinite(runMs) || deployments.length === 0) return null;
  const shaKey = headSha.slice(0, 12);

  let best: RepoDeploymentRow | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const d of deployments) {
    if (d.sha.slice(0, 12) !== shaKey) continue;
    const delta = Math.abs(d.createdAtMs - runMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = d;
    }
  }
  if (!best || bestDelta > ENV_CORRELATION_WINDOW_MS) return null;
  return best.environment;
}

function inferEnvironmentFromWorkflow(input: DeployRunResolveInput): DeployEnvironmentKey | null {
  if (input.status === 'completed') return null;
  if (TST_BUILD_WORKFLOW_IDS.has(input.workflowId)) return 'tst';
  if (DEV_FAST_WORKFLOW_IDS.has(input.workflowId)) return 'dev';
  return null;
}

/**
 * Resolve a run's TARGET environment (not branch). Order: Deployments API → job names → workflow hint.
 */
export function resolveDeployRunEnvironment(
  input: DeployRunResolveInput,
  deployments: readonly RepoDeploymentRow[]
): DeployEnvironmentKey | null {
  const fromDeployment = resolveEnvironmentFromDeployments(input, deployments);
  if (fromDeployment) return fromDeployment;

  if (input.jobNames && input.jobNames.length > 0) {
    const fromJobs = parseEnvironmentFromJobNames(input.jobNames);
    if (fromJobs) return fromJobs;
  }

  return inferEnvironmentFromWorkflow(input);
}
