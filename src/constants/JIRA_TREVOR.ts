/**
 * Trevor's dashboard: JQL for dev team tickets across OPRD, CM, NOVA.
 * Uses assignee WAS IN with Atlassian account IDs.
 * Last 6 months, excludes case phase, Epic, Sub-task.
 */
export const JIRA_TREVOR_CACHE_TTL_MS = 5 * 60 * 1000;

export const JIRA_TREVOR_JQL =
  `project IN (OPRD, CM, NOVA) ` +
  `AND assignee WAS IN (712020:a6b7bce7-9035-4bd2-b2a3-cef5a6991f3f, 712020:4a657f3c-6d1e-41be-88fc-e168a5e75cbd, 712020:7d1dde47-7dd4-4e25-a87f-25f3f20b6837, 712020:02567f23-bfb1-419b-aadd-9e51f5ed81ef) ` +
  `AND createdDate >= startOfMonth(-6) ` +
  `AND issuetype NOT IN ("case phase", "Epic", "Sub-task") ` +
  `ORDER BY created DESC`;
