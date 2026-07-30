import { LIVE_DEPLOY_WORKFLOW_MONITORS } from '@/constants/GITHUB_DEPLOY_MONITORS';
import {
  getGitHubAppInstallationToken,
  hasGitHubAppConfig,
} from '@/lib/githubAppAuth';
import {
  fetchAllDeployWorkflowStatuses,
  mergeDeployStatusesInMonitorOrder,
} from '@/services/github/fetchDeployWorkflowStatus';
import type { GitHubDeployWorkflowStatus } from '@/types/github/GitHubDeployStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Aggregates latest CD workflow runs for monitored CPT-Group repos (Actions API).
 * Token order: **`GITHUB_APP`** (installation token) → **`GH_MASTER_PAT_KYLE`** →
 * **`GH_ROY_PAT_MASTER_CLASSIC`** → **`GITHUB_TOKEN_3`** → **`GITHUB_TOKEN_2`** →
 * **`GITHUB_DEPLOY_READ_TOKEN`**.
 * **Rotation:** try the next token when the current one clearly cannot serve the board:
 * - Core rate-limit remaining is below the refresh budget (skip — never burn a 0/5000 PAT), or
 * - That GitHub **user** is already exhausted this refresh (classic PATs share one 5000/hr budget
 *   per user — Kyle’s PAT and `GITHUB_DEPLOY_READ_TOKEN` are the same account; Roy’s classics share
 *   another). App installation tokens have a separate budget and are tried first, or
 * - **Any** repo returns hard auth / rate-limit (`401`, `bad credentials`, `rate limit`), or
 * - **Every** repo fails with a retryable error (`401`, `403`, `404`, rate limit, bad credentials) —
 *   e.g. fine-grained PAT with `/user` OK but **no Actions** access → **404** on all workflow-run URLs.
 * - Deployments API degraded (`deploymentsDiag.ok === false`) — advances so a stronger PAT can retry.
 */
function liveDeployRows(repos: GitHubDeployWorkflowStatus[]): GitHubDeployWorkflowStatus[] {
  return repos.filter((row) => !row.isPlaceholder);
}

function errorText(row: GitHubDeployWorkflowStatus): string {
  return (row.error ?? '').toLowerCase();
}

function hasHardTokenFailure(row: GitHubDeployWorkflowStatus): boolean {
  if (!row.error) return false;
  const m = errorText(row);
  return m.includes('github 401') || m.includes('bad credentials') || m.includes('rate limit');
}

function shouldAdvanceTokenInChain(repos: GitHubDeployWorkflowStatus[]): boolean {
  const live = liveDeployRows(repos);
  if (live.length === 0) return false;
  if (live.some((row) => hasHardTokenFailure(row))) return true;
  // A rate-limited Deployments API (403 → empty stg/prod) is swallowed by fetchRepoDeployments and
  // never sets row.error, so it wouldn't trip the checks below. Surface it via deploymentsDiag so a
  // token whose Deployments budget is exhausted fails over to the next token in the chain.
  if (hasDeploymentsFetchDegraded(repos)) return true;
  return live.every((row) => {
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
  | 'GITHUB_APP'
  | 'GH_MASTER_PAT_KYLE'
  | 'GH_ROY_PAT_MASTER_CLASSIC'
  | 'GITHUB_TOKEN_3'
  | 'GITHUB_TOKEN_2'
  | 'GITHUB_DEPLOY_READ_TOKEN';
type DeployStatusSource = 'live' | 'cache' | 'stale-cache';

const DEPLOY_TOKEN_ENV_HINT =
  'GITHUB_APP_* (ID + INSTALLATION_ID + PRIVATE_KEY), GH_MASTER_PAT_KYLE, GH_ROY_PAT_MASTER_CLASSIC, GITHUB_TOKEN_3, GITHUB_TOKEN_2, GITHUB_DEPLOY_READ_TOKEN';

/** Skip a PAT when core remaining cannot cover one deploy-status refresh (~30–45 GitHub calls). */
const MIN_CORE_REMAINING_FOR_REFRESH = 50;

const ALL_TOKENS_RATE_LIMITED_MESSAGE =
  'All GitHub deploy tokens are rate-limited (per-user API budgets exhausted). Retry after the hourly reset, or add a PAT from a different GitHub user.';

/** Process-lifetime cache: PAT string → GitHub numeric user id (classic PATs share budget per user). */
const tokenUserIdCache = new Map<string, number>();

function githubApiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cpt-internal-dashboard',
  };
}

/** `/rate_limit` does not consume the budget. */
async function getCoreRateLimitRemaining(token: string): Promise<number | null> {
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: githubApiHeaders(token),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      resources?: { core?: { remaining?: number } };
    };
    const remaining = data.resources?.core?.remaining;
    return typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : null;
  } catch {
    return null;
  }
}

async function resolveGithubUserId(token: string): Promise<number | null> {
  const cached = tokenUserIdCache.get(token);
  if (cached != null) return cached;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: githubApiHeaders(token),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: number };
    if (typeof data.id !== 'number' || !Number.isFinite(data.id)) return null;
    tokenUserIdCache.set(token, data.id);
    return data.id;
  } catch {
    return null;
  }
}

function parseRateLimitedUserIdFromRepos(repos: GitHubDeployWorkflowStatus[]): number | null {
  for (const row of liveDeployRows(repos)) {
    if (!row.error) continue;
    const match = /rate limit exceeded for user ID (\d+)/i.exec(row.error);
    if (match?.[1]) {
      const id = Number(match[1]);
      if (Number.isFinite(id)) return id;
    }
  }
  return null;
}

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

// 20s: with the 40-probe env index removed, a refresh is ~30-45 GitHub calls (Auto-Merge workflows
// added). At 20s the board stays under the token hourly budget while catching Dev Fast / TST
// Auto-Merge within about half a minute (was 45s — TV often looked idle until CD was nearly done).
const DEPLOY_STATUS_CACHE_TTL_MS = 20_000;
const DEPLOY_STATUS_STALE_MAX_MS = 5 * 60_000;
const DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS = 60_000;

let deployStatusCache: DeployStatusCacheEntry | null = null;
let deployStatusInFlight: Promise<DeployStatusCacheEntry> | null = null;
let rateLimitCooldownUntilMs = 0;

function hasAnyRepoError(repos: GitHubDeployWorkflowStatus[]): boolean {
  return liveDeployRows(repos).some((row) => Boolean(row.error));
}

function hasRateLimitOrAuthError(repos: GitHubDeployWorkflowStatus[]): boolean {
  return liveDeployRows(repos).some((row) => {
    if (!row.error) return false;
    const message = row.error.toLowerCase();
    return message.includes('rate limit') || message.includes('github 403') || message.includes('github 401');
  });
}

/**
 * A repo's GitHub Deployments API fetch degraded (403/404/timeout → empty), which silently empties
 * its stg/prod lane snapshots even though the run fetch (dev/tst) succeeded. Treat this like a
 * rate-limit: prefer the last-good cache over publishing a false "N/A" for a real prior deploy.
 * This is the guard for the transient stale-N/A that surfaced on 2026-06-30.
 */
function hasDeploymentsFetchDegraded(repos: GitHubDeployWorkflowStatus[]): boolean {
  return liveDeployRows(repos).some((row) => row.deploymentsDiag?.ok === false);
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

async function buildDeployTokenChain(): Promise<Array<{ tokenUsed: DeployStatusTokenUsed; token: string }>> {
  const rawChain: Array<{ tokenUsed: DeployStatusTokenUsed; token: string } | null> = [];

  if (hasGitHubAppConfig()) {
    try {
      const appToken = await getGitHubAppInstallationToken();
      rawChain.push({ tokenUsed: 'GITHUB_APP', token: appToken });
    } catch (error) {
      // Fall through to personal PATs — App misconfig should not blank the board if PATs work.
      console.error(
        '[deploy-status] GitHub App installation token failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  const masterPat = process.env.GH_MASTER_PAT_KYLE?.trim();
  const royPat = process.env.GH_ROY_PAT_MASTER_CLASSIC?.trim();
  const token3 = process.env.GITHUB_TOKEN_3?.trim();
  const token2 = process.env.GITHUB_TOKEN_2?.trim();
  const deployRead = process.env.GITHUB_DEPLOY_READ_TOKEN?.trim();
  rawChain.push(
    masterPat ? { tokenUsed: 'GH_MASTER_PAT_KYLE', token: masterPat } : null,
    royPat ? { tokenUsed: 'GH_ROY_PAT_MASTER_CLASSIC', token: royPat } : null,
    token3 ? { tokenUsed: 'GITHUB_TOKEN_3', token: token3 } : null,
    token2 ? { tokenUsed: 'GITHUB_TOKEN_2', token: token2 } : null,
    deployRead ? { tokenUsed: 'GITHUB_DEPLOY_READ_TOKEN', token: deployRead } : null
  );

  const seenTokenValues = new Set<string>();
  return rawChain.filter((entry): entry is { tokenUsed: DeployStatusTokenUsed; token: string } => {
    if (!entry) return false;
    if (seenTokenValues.has(entry.token)) return false;
    seenTokenValues.add(entry.token);
    return true;
  });
}

async function fetchDeployStatusFromTokenChain(): Promise<DeployStatusCacheEntry> {
  const tokenChain = await buildDeployTokenChain();

  if (tokenChain.length === 0) {
    throw new Error(`Missing deploy tokens (set at least one of: ${DEPLOY_TOKEN_ENV_HINT})`);
  }

  const exhaustedUserIds = new Set<number>();
  let lastAttempt: DeployStatusCacheEntry | null = null;
  let attemptedAny = false;

  for (let i = 0; i < tokenChain.length; i += 1) {
    const chainEntry = tokenChain[i];
    const hasNextToken = i < tokenChain.length - 1;

    const remaining = await getCoreRateLimitRemaining(chainEntry.token);
    const userId = await resolveGithubUserId(chainEntry.token);

    if (userId != null && exhaustedUserIds.has(userId)) {
      continue;
    }

    // Never burn a PAT that cannot finish a refresh — including the last chain entry.
    if (remaining !== null && remaining < MIN_CORE_REMAINING_FOR_REFRESH) {
      if (userId != null) exhaustedUserIds.add(userId);
      continue;
    }

    attemptedAny = true;
    const liveRepos = await fetchAllDeployWorkflowStatuses(
      chainEntry.token,
      LIVE_DEPLOY_WORKFLOW_MONITORS
    );
    const repos = mergeDeployStatusesInMonitorOrder(liveRepos);
    lastAttempt = { repos, tokenUsed: chainEntry.tokenUsed, fetchedAtMs: Date.now() };

    const advance = shouldAdvanceTokenInChain(repos);
    if (!advance) {
      return lastAttempt;
    }

    // Rate-limit / auth failure on this PAT → mark that GitHub user exhausted for the rest of the chain.
    if (hasRateLimitOrAuthError(repos)) {
      const fromError = parseRateLimitedUserIdFromRepos(repos);
      if (fromError != null) exhaustedUserIds.add(fromError);
      if (userId != null) exhaustedUserIds.add(userId);
    }

    if (!hasNextToken) {
      break;
    }
  }

  if (lastAttempt != null && !hasRateLimitOrAuthError(lastAttempt.repos)) {
    return lastAttempt;
  }

  // All PATs skipped (budgets empty) or every attempt was rate-limited — throw so GET can serve
  // stale cache, instead of publishing "API rate limit exceeded" on every card.
  if (!attemptedAny || lastAttempt == null || hasRateLimitOrAuthError(lastAttempt.repos)) {
    throw new Error(ALL_TOKENS_RATE_LIMITED_MESSAGE);
  }

  return lastAttempt;
}

async function getFreshDeployStatus(nowMs: number): Promise<DeployStatusCacheEntry> {
  if (deployStatusInFlight) {
    return deployStatusInFlight;
  }

  deployStatusInFlight = (async () => {
    const fresh = await fetchDeployStatusFromTokenChain();
    const freshHasErrors = hasAnyRepoError(fresh.repos);
    const freshHasRateLimit = hasRateLimitOrAuthError(fresh.repos);
    const freshHasDeploymentsDegraded = hasDeploymentsFetchDegraded(fresh.repos);
    const hasUsableStaleCache =
      deployStatusCache != null &&
      nowMs - deployStatusCache.fetchedAtMs <= DEPLOY_STATUS_STALE_MAX_MS;

    // Prefer the last-good cache when the fresh fetch is degraded — a hard rate-limit/auth error OR
    // a silently-empty Deployments API fetch (which would false-"N/A" real stg/prod deploys).
    if ((freshHasDeploymentsDegraded || (freshHasErrors && freshHasRateLimit)) && hasUsableStaleCache) {
      rateLimitCooldownUntilMs = nowMs + DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS;
      return deployStatusCache as DeployStatusCacheEntry;
    }

    // Never replace a good board with a rate-limit error payload (even if stale window lapsed).
    if (freshHasErrors && freshHasRateLimit && deployStatusCache != null) {
      rateLimitCooldownUntilMs = nowMs + DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS;
      return deployStatusCache;
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
    hasGitHubAppConfig() ||
      process.env.GH_MASTER_PAT_KYLE?.trim() ||
      process.env.GH_ROY_PAT_MASTER_CLASSIC?.trim() ||
      process.env.GITHUB_TOKEN_2?.trim() ||
      process.env.GITHUB_TOKEN_3?.trim() ||
      process.env.GITHUB_DEPLOY_READ_TOKEN?.trim()
  );

  if (!hasAnyToken) {
    return Response.json(
      {
        ok: false,
        message: `Missing deploy tokens (set at least one of: ${DEPLOY_TOKEN_ENV_HINT})`,
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
    const message = error instanceof Error ? error.message : 'Failed to fetch deploy status';
    if (message === ALL_TOKENS_RATE_LIMITED_MESSAGE || /rate.?limit/i.test(message)) {
      rateLimitCooldownUntilMs = nowMs + DEPLOY_STATUS_RATE_LIMIT_COOLDOWN_MS;
    }
    if (deployStatusCache && nowMs - deployStatusCache.fetchedAtMs <= DEPLOY_STATUS_STALE_MAX_MS) {
      return Response.json(toSuccessResponse(deployStatusCache, 'stale-cache', nowMs));
    }
    return Response.json({ ok: false, message, repos: [] }, { status: 503 });
  }
}
