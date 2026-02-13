/**
 * Operational Jira dashboard: current day / sprint focus.
 * Same project as Dev1 (NOVA); queries for open, opened today, closed today, and flow.
 */
export const JIRA_OPERATIONAL_PROJECT = 'NOVA';

const BASE =
  `project = ${JIRA_OPERATIONAL_PROJECT} ` +
  `AND issuetype NOT IN ("Epic", "Sub-task")`;

/** All open issues (for KPIs, backlog by component, dev matrix, aging, oldest 10). */
export const JIRA_OPERATIONAL_JQL_OPEN =
  BASE + ` AND statusCategory != Done ORDER BY created ASC`;

/** Created today (for "opened today" and flow). */
export const JIRA_OPERATIONAL_JQL_OPENED_TODAY =
  BASE + ` AND created >= startOfDay() ORDER BY created DESC`;

/** Resolved today (for "closed today" and flow). */
export const JIRA_OPERATIONAL_JQL_CLOSED_TODAY =
  BASE + ` AND resolutiondate >= startOfDay() ORDER BY resolutiondate DESC`;

/** Created in last 14 days (for flow chart opened-by-day). */
export const JIRA_OPERATIONAL_JQL_CREATED_LAST_14 =
  BASE + ` AND created >= startOfDay(-14) ORDER BY created DESC`;

/** Resolved in last 14 days (for flow chart closed-by-day). */
export const JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14 =
  BASE + ` AND resolutiondate >= startOfDay(-14) ORDER BY resolutiondate DESC`;
