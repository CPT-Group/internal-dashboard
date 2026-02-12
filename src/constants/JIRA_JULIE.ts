/**
 * Julie's board: Jira config (stub).
 * Reuse JIRA_SHARED.JIRA_CACHE_TTL_MS. Define JQL and team filter when dashboard is implemented.
 */
export const JIRA_JULIE_JQL_OPEN = 'assignee = currentUser() AND statusCategory != Done order by updated DESC';
