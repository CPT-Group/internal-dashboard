/**
 * Operational Jira dashboard: Dev team board spanning CM, OPRD, and NOVA.
 * JQL modeled after the "Case Management Data Team Board" filter (V.3).
 */

export const JIRA_OPERATIONAL_PROJECTS = ['CM', 'OPRD', 'NOVA'] as const;

/** Components tracked on the dev board (shared by CM and OPRD). */
const CM_OPRD_COMPONENTS = [
  'NCOA/ACS',
  'Interactive Website',
  'Static Website',
  'Case Database',
  'Web Database',
  'Downloader',
  'Weekly Reports',
  'SCP',
  'Shut Down Service',
  'Data Analysis',
  'Database Migration',
  'Website',
].map((c) => `"${c}"`).join(', ');

/**
 * Scoped filter: items in our dev scope regardless of status.
 * Used as a base for both open and time-based (created/resolved) queries.
 */
const SCOPED_FILTER = [
  `( project = CM AND component IN (${CM_OPRD_COMPONENTS}) AND issuetype != Epic )`,
  `( project = OPRD AND component IN (${CM_OPRD_COMPONENTS}) AND issuetype != Epic )`,
  `( project = NOVA AND issuetype NOT IN ("Epic", "Sub-task") )`,
].join(' OR ');

/**
 * Open/active items only (adds status exclusions per project).
 * - CM: not Done (case management items in workflow)
 * - OPRD: not New, not Done (operational dev work in progress)
 * - NOVA: not Done (software development)
 */
const BOARD_FILTER = [
  `( project = CM AND statusCategory != Done AND component IN (${CM_OPRD_COMPONENTS}) AND issuetype != Epic )`,
  `( project = OPRD AND status != New AND statusCategory != Done AND component IN (${CM_OPRD_COMPONENTS}) AND issuetype != Epic )`,
  `( project = NOVA AND issuetype NOT IN ("Epic", "Sub-task") AND statusCategory != Done )`,
].join(' OR ');

/** All open/active issues matching the dev board (KPIs, backlog, aging, oldest 10). */
export const JIRA_OPERATIONAL_JQL_OPEN =
  `${BOARD_FILTER} ORDER BY created DESC`;

/** Created today (scoped to dev components). */
export const JIRA_OPERATIONAL_JQL_OPENED_TODAY =
  `(${SCOPED_FILTER}) AND created >= startOfDay() ORDER BY created DESC`;

/** Resolved today (scoped to dev components). */
export const JIRA_OPERATIONAL_JQL_CLOSED_TODAY =
  `(${SCOPED_FILTER}) AND resolutiondate >= startOfDay() ORDER BY resolutiondate DESC`;

/** Created in last 14 days (flow chart). */
export const JIRA_OPERATIONAL_JQL_CREATED_LAST_14 =
  `(${SCOPED_FILTER}) AND created >= startOfDay(-14) ORDER BY created DESC`;

/** Resolved in last 14 days (flow chart). */
export const JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14 =
  `(${SCOPED_FILTER}) AND resolutiondate >= startOfDay(-14) ORDER BY resolutiondate DESC`;

/** Created in previous 14-day window (days -28 to -14) for trend comparison. */
export const JIRA_OPERATIONAL_JQL_CREATED_PREV_14 =
  `(${SCOPED_FILTER}) AND created >= startOfDay(-28) AND created < startOfDay(-14) ORDER BY created DESC`;

/** Resolved in previous 14-day window (days -28 to -14) for trend comparison. */
export const JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14 =
  `(${SCOPED_FILTER}) AND resolutiondate >= startOfDay(-28) AND resolutiondate < startOfDay(-14) ORDER BY resolutiondate DESC`;
