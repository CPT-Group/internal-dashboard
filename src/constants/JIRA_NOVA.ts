/** Jira project key for NOVA (Dev Corner Two dashboard). */
export const JIRA_NOVA_PROJECT = 'NOVA';

/** JQL: tickets updated today (NOVA). */
export const JIRA_NOVA_JQL_TODAY =
  `project = ${JIRA_NOVA_PROJECT} AND updated >= startOfDay(-0) order by updated DESC`;

/** JQL: open tickets (not Done) for NOVA. */
export const JIRA_NOVA_JQL_OPEN =
  `project = ${JIRA_NOVA_PROJECT} AND statusCategory != Done order by updated DESC`;

/** JQL: overdue (late) tickets for NOVA. */
export const JIRA_NOVA_JQL_OVERDUE =
  `project = ${JIRA_NOVA_PROJECT} AND duedate < now() AND statusCategory != Done order by duedate ASC`;

/** JQL: completed (Done) tickets for NOVA. */
export const JIRA_NOVA_JQL_DONE =
  `project = ${JIRA_NOVA_PROJECT} AND statusCategory = Done order by updated DESC`;
