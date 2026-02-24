/**
 * Dev Corner One dashboard configuration constants.
 * Risk weights for aging buckets and display thresholds.
 */

/** Weights per aging bucket for risk score calculation (index matches bucket order). */
export const DEV1_RISK_BUCKET_WEIGHTS = [0, 1, 2, 4, 8] as const;

/** Max raw weighted score used to normalize risk to 0–100. */
export const DEV1_RISK_MAX_RAW = 100;

/** Number of aging hotspot rows to show. */
export const DEV1_HOTSPOT_LIMIT = 5;

/** Age threshold (days) for "stale" badge on action queue tickets. */
export const DEV1_STALE_DAYS_THRESHOLD = 14;
