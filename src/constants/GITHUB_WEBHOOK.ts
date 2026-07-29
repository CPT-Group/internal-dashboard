/** In-memory ring buffer size for GitHub webhook deliveries (per server instance). */
export const GITHUB_WEBHOOK_CACHE_MAX_EVENTS = 100;

/** Drop entries older than this when pushing new events. */
export const GITHUB_WEBHOOK_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** TV dashboard poll interval for GET /api/webhooks/github (aligns with soft refresh idea). */
export const GITHUB_ACTIVITY_POLL_INTERVAL_MS = 60_000;

/**
 * Dev Corner Two CD deploy-status poll (`GET /api/github/deploy-status`).
 * Tighter than webhook activity — wall TVs need to catch Dev Fast / TST Auto-Merge within ~30s.
 * Paired with server cache TTL in `deploy-status/route.ts` (~20s).
 */
export const GITHUB_DEPLOY_STATUS_POLL_INTERVAL_MS = 25_000;
