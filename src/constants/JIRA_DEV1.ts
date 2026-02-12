/**
 * Dev Corner One: NOVA project, all assignees, last 6 months.
 * General dev view – by assignee, type, component, time to close.
 */
export const JIRA_DEV1_PROJECT = 'NOVA';

const JIRA_DEV1_BASE_JQL =
  `project = ${JIRA_DEV1_PROJECT} ` +
  `AND createdDate >= startOfMonth(-6) ` +
  `AND issuetype NOT IN ("Epic", "Sub-task")`;

/** Full list for charts and analytics. */
export const JIRA_DEV1_JQL = JIRA_DEV1_BASE_JQL + ` ORDER BY created DESC`;

/** Open count only (maxResults=0 for total). */
export const JIRA_DEV1_JQL_OPEN = JIRA_DEV1_BASE_JQL + ` AND statusCategory != Done`;
