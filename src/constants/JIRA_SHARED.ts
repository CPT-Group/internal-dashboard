/**
 * Shared Jira config for all dev-corner TV dashboards (NOVA, Trevor, Dev1, Julie).
 * Single refresh interval so boards stay reasonably real-time without excess API calls.
 */
export const JIRA_CACHE_TTL_MS = 30 * 60 * 1000;

export const JIRA_SEARCH_MAX_RESULTS = 1000;

/** Jira custom field ID for Tech Owner (the dev who actually does the work). */
export const JIRA_FIELD_TECH_OWNER = 'customfield_10193';
