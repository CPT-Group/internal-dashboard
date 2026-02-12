/**
 * Trevor's dashboard: JQL for dev team tickets across OPRD, CM, NOVA.
 * Confined to the 4 of us via assignee IN (user IDs from TREVOR_TEAM_ACCOUNT_IDS).
 * Last 6 months, excludes case phase, Epic, Sub-task.
 */
import { TREVOR_TEAM_ACCOUNT_IDS_ARRAY } from './TREVOR_TEAM';

const assigneeList = TREVOR_TEAM_ACCOUNT_IDS_ARRAY.join(', ');

const JIRA_TREVOR_BASE_JQL =
  `project IN (OPRD, CM, NOVA) ` +
  `AND assignee IN (${assigneeList}) ` +
  `AND createdDate >= startOfMonth(-6) ` +
  `AND issuetype NOT IN ("case phase", "Epic", "Sub-task")`;

/** Full list (for charts, Gantt). */
export const JIRA_TREVOR_JQL = JIRA_TREVOR_BASE_JQL + ` ORDER BY created DESC`;

/** Open count only (statusCategory != Done) – use with maxResults=1 to get Jira total without fetching all issues. */
export const JIRA_TREVOR_JQL_OPEN =
  JIRA_TREVOR_BASE_JQL + ` AND statusCategory != Done`;
