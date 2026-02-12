/**
 * Dev Corner One dashboard: Jira config (stub).
 * Reuse JIRA_SHARED.JIRA_CACHE_TTL_MS. Define JQL and optional team filter when dashboard is implemented.
 */
export const JIRA_DEV1_PROJECT = 'NOVA';

export const JIRA_DEV1_JQL_OPEN = `project = ${JIRA_DEV1_PROJECT} AND statusCategory != Done order by updated DESC`;
