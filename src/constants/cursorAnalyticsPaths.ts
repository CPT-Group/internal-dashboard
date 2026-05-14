/**
 * Tracked Cursor analytics inputs/outputs (committed for Netlify / CI).
 * Summarizer: `npm run cursor-analytics:regen` — reads every `*.csv` in {@link CURSOR_ANALYTICS_CSV_DIR_REL}.
 * Override with `CURSOR_ANALYTICS_SUMMARY_JSON` (see `GET /api/cursor-analytics`).
 */
export const CURSOR_ANALYTICS_CSV_DIR_REL = 'data/cursor-analytics/csv';

/** JSON written by the summarizer and read by the API route (default). */
export const CURSOR_ANALYTICS_SUMMARY_JSON_REL = 'data/cursor-analytics/cursor-analytics-summary.json';
