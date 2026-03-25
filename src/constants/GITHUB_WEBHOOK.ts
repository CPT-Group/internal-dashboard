/** In-memory ring buffer size for GitHub webhook deliveries (per server instance). */
export const GITHUB_WEBHOOK_CACHE_MAX_EVENTS = 100;

/** Drop entries older than this when pushing new events. */
export const GITHUB_WEBHOOK_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** TV dashboard poll interval for GET /api/webhooks/github (aligns with soft refresh idea). */
export const GITHUB_ACTIVITY_POLL_INTERVAL_MS = 60_000;
