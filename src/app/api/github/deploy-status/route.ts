import { GITHUB_DEPLOY_WORKFLOW_MONITORS } from '@/constants/GITHUB_DEPLOY_MONITORS';
import { fetchAllDeployWorkflowStatuses } from '@/services/github/fetchDeployWorkflowStatus';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregates latest CD workflow runs for monitored CPT-Group repos (Actions API).
 * Token order: **`GITHUB_TOKEN_3`** → **`GITHUB_TOKEN_2`** → **`GITHUB_DEPLOY_READ_TOKEN`**.
 * **Rotation:** try the next token when the current one clearly cannot serve the board:
 * - **Any** repo returns hard auth / rate-limit (`401`, `bad credentials`, `rate limit`), or
 * - **Every** repo fails with a retryable error (`401`, `403`, `404`, rate limit, bad credentials) —
 *   e.g. fine-grained PAT with `/user` OK but **no Actions** access → **404** on all workflow-run URLs.
 */
function errorText(row: GitHubDeployWorkflowStatus): string {
  return (row.error ?? '').toLowerCase();
}

function hasHardTokenFailure(row: GitHubDeployWorkflowStatus): boolean {
  if (!row.error) return false;
  const m = errorText(row);
  return m.includes('github 401') || m.includes('bad credentials') || m.includes('rate limit');
}

function shouldAdvanceTokenInChain(repos: GitHubDeployWorkflowStatus[]): boolean {
  if (repos.length === 0) return false;
  if (repos.some((row) => hasHardTokenFailure(row))) return true;
  return repos.every((row) => {
    if (!row.error) return false;
    const m = errorText(row);
    return (
      m.includes('rate limit') ||
      m.includes('github 401') ||
      m.includes('github 403') ||
      m.includes('github 404') ||
      m.includes('bad credentials')
    );
  });
}

/** Which env token produced the successful fetch (telemetry only). */
type DeployStatusTokenUsed =
  | 'GITHUB_TOKEN_3'
  | 'GITHUB_TOKEN_2'
  | 'GITHUB_DEPLOY_READ_TOKEN';
type DeployStatusSource = 'live' | 'cache' | 'stale-cache';

interface DeployStatusSuccessResponse {
  ok: true;
  repos: GitHubDeployWorkflowStatus[];
  tokenUsed: DeployStatusTokenUsed;
  source: DeployStatusSource;
  cacheAgeMs: number;
}

interface DeployStatusCacheEntry {
  repos: GitHubDeployWorkflowStatus[];
  tokenUsed: DeployStatusTokenUsed;
  fetchedAtMs: number;
}

const DEPLOY_STATUS_CACHE_TTL_MS = 20_000;
const DEPLOY_STATUS_STALE_MAX_MS = 5 * 60_000;
const DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS = 60_000;

let deployStatusCache: DeployStatusCacheEntry | null = null;
let deployStatusInFlight: Promise<DeployStatusCacheEntry> | null = null;
let rateLimitCooldownUntilMs = 0;

function hasAnyRepoError(repos: GitHubDeployWorkflowStatus[]): boolean {
  return repos.some((row) => Boolean(row.error));
}

function hasRateLimitOrAuthError(repos: GitHubDeployWorkflowStatus[]): boolean {
  return repos.some((row) => {
    if (!row.error) return false;
    const message = row.error.toLowerCase();
    return message.includes('rate limit') || message.includes('github 403') || message.includes('github 401');
  });
}

function toSuccessResponse(
  entry: DeployStatusCacheEntry,
  source: DeployStatusSource,
  nowMs: number
): DeployStatusSuccessResponse {
  return {
    ok: true,
    repos: entry.repos,
    tokenUsed: entry.tokenUsed,
    source,
    cacheAgeMs: Math.max(0, nowMs - entry.fetchedAtMs),
  };
}

async function fetchDeployStatusFromTokenChain(): Promise<DeployStatusCacheEntry> {
  const token3 = process.env.GITHUB_TOKEN_3?.trim();
  const token2 = process.env.GITHUB_TOKEN_2?.trim();
  const deployRead = process.env.GITHUB_DEPLOY_READ_TOKEN?.trim();
  const tokenChain: Array<{ tokenUsed: DeployStatusTokenUsed; token: string }> = [
    token3 ? { tokenUsed: 'GITHUB_TOKEN_3', token: token3 } : null,
    token2 ? { tokenUsed: 'GITHUB_TOKEN_2', token: token2 } : null,
    deployRead ? { tokenUsed: 'GITHUB_DEPLOY_READ_TOKEN', token: deployRead } : null,
  ].filter((entry): entry is { tokenUsed: DeployStatusTokenUsed; token: string } => Boolean(entry));

  if (tokenChain.length === 0) {
    throw new Error(
      'Missing deploy tokens (set at least one of: GITHUB_TOKEN_3, GITHUB_TOKEN_2, GITHUB_DEPLOY_READ_TOKEN)'
    );
  }

  for (let i = 0; i < tokenChain.length; i += 1) {
    const chainEntry = tokenChain[i];
    const repos = await fetchAllDeployWorkflowStatuses(chainEntry.token, GITHUB_DEPLOY_WORKFLOW_MONITORS);
    const advance = shouldAdvanceTokenInChain(repos);
    const hasNextToken = i < tokenChain.length - 1;
    if (!advance || !hasNextToken) {
      return { repos, tokenUsed: chainEntry.tokenUsed, fetchedAtMs: Date.now() };
    }
  }

  return { repos: [], tokenUsed: tokenChain[tokenChain.length - 1]!.tokenUsed, fetchedAtMs: Date.now() };
}

async function getFreshDeployStatus(nowMs: number): Promise<DeployStatusCacheEntry> {
  if (deployStatusInFlight) {
    return deployStatusInFlight;
  }

  deployStatusInFlight = (async () => {
    const fresh = await fetchDeployStatusFromTokenChain();
    const freshHasErrors = hasAnyRepoError(fresh.repos);
    const freshHasRateLimit = hasRateLimitOrAuthError(fresh.repos);
    const hasUsableStaleCache =
      deployStatusCache != null &&
      nowMs - deployStatusCache.fetchedAtMs <= DEPLOY_STATUS_STALE_MAX_MS;

    if (freshHasErrors && freshHasRateLimit && hasUsableStaleCache) {
      rateLimitCooldownUntilMs = nowMs + DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS;
      return deployStatusCache as DeployStatusCacheEntry;
    }

    deployStatusCache = fresh;
    return fresh;
  })();

  try {
    return await deployStatusInFlight;
  } finally {
    deployStatusInFlight = null;
  }
}

export async function GET(): Promise<Response> {
  const nowMs = Date.now();
  const hasAnyToken = Boolean(
    process.env.GITHUB_TOKEN_2?.trim() ||
    process.env.GITHUB_TOKEN_3?.trim() ||
    process.env.GITHUB_DEPLOY_READ_TOKEN?.trim()
  );

  if (!hasAnyToken) {
    return Response.json(
      {
        ok: false,
        message:
          'Missing deploy tokens (set at least one of: GITHUB_TOKEN_3, GITHUB_TOKEN_2, GITHUB_DEPLOY_READ_TOKEN)',
        repos: [],
      },
      { status: 503 }
    );
  }

  if (deployStatusCache && nowMs - deployStatusCache.fetchedAtMs <= DEPLOY_STATUS_CACHE_TTL_MS) {
    return Response.json(toSuccessResponse(deployStatusCache, 'cache', nowMs));
  }

  if (deployStatusCache && nowMs < rateLimitCooldownUntilMs) {
    return Response.json(toSuccessResponse(deployStatusCache, 'stale-cache', nowMs));
  }

  try {
    const fresh = await getFreshDeployStatus(nowMs);
    const source: DeployStatusSource =
      fresh === deployStatusCache && nowMs - fresh.fetchedAtMs > DEPLOY_STATUS_CACHE_TTL_MS
        ? 'stale-cache'
        : 'live';
    return Response.json(toSuccessResponse(fresh, source, Date.now()));
  } catch (error) {
    if (deployStatusCache && nowMs - deployStatusCache.fetchedAtMs <= DEPLOY_STATUS_STALE_MAX_MS) {
      return Response.json(toSuccessResponse(deployStatusCache, 'stale-cache', nowMs));
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch deploy status';
    return Response.json({ ok: false, message, repos: [] }, { status: 503 });
  }
}
