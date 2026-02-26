/**
 * Shared Jira config for all dev-corner TV dashboards (NOVA, Trevor, Dev1, Julie).
 *
 * Data refresh is time-aware:
 *   Business hours (6 AM – 8 PM Pacific): 20 min
 *   Off hours: 60 min
 */
const BUSINESS_TTL_MS = 20 * 60 * 1000;
const OFF_HOURS_TTL_MS = 60 * 60 * 1000;
const BUSINESS_START_HOUR = 6;
const BUSINESS_END_HOUR = 20;

function getPacificHour(): number {
  const utc = new Date();
  const pacific = new Date(utc.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return pacific.getHours();
}

export function getJiraCacheTtl(): number {
  const hour = getPacificHour();
  return hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR
    ? BUSINESS_TTL_MS
    : OFF_HOURS_TTL_MS;
}

export const JIRA_SEARCH_MAX_RESULTS = 1000;

/** Jira custom field ID for Tech Owner (the dev who actually does the work). */
export const JIRA_FIELD_TECH_OWNER = 'customfield_10193';
