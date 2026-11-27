/**
 * Named Jira searches the dashboard may run through `GET /api/jira/search`.
 *
 * The browser sends only a NAME from this list (plus a bounded `maxResults` / `fields`, and the
 * declared parameters for the two parameterised queries). The JQL behind each name is defined
 * server-side in `src/services/jira/namedQueries.ts`; the route refuses raw JQL and unknown names.
 *
 * Adding a widget query: add the name here, then its JQL in `namedQueries.ts` (the registry is
 * typed `Record<JiraNamedQueryName, ...>`, so a name without JQL fails type-check).
 */
export const JIRA_NAMED_QUERY_NAMES = [
  // Dev Corner One (dev1JiraStore)
  'dev1-list',
  'dev1-open',
  // Dev Corner Two (jiraNovaStore)
  'nova-today',
  'nova-open',
  'nova-overdue',
  'nova-done',
  // Trevor's Screen (trevorJiraStore)
  'trevor-list',
  'trevor-open',
  // Operational board (operationalJiraStore - Dev Corner One / Two, Trevor)
  'operational-open',
  'operational-limbo',
  'operational-landed-today',
  'operational-closed-today',
  'operational-landed-last-14',
  'operational-resolved-last-14',
  'operational-landed-prev-14',
  'operational-resolved-prev-14',
  'impediment-link-carriers',
  // Office corner screens (useAssignedJiraTickets) - takes `accountId`
  'office-assigned-active',
  // Fine-tuned widget calls (services/api/endpoints/jira)
  'nova-transitioned-today',
  'nova-created-today',
  'nova-updated-since', // takes `since` (yyyy-MM-dd HH:mm)
] as const;

export type JiraNamedQueryName = (typeof JIRA_NAMED_QUERY_NAMES)[number];

/** Query-string parameters a named query may declare. Each has a strict server-side validator. */
export const JIRA_NAMED_QUERY_PARAM_NAMES = ['accountId', 'since'] as const;

export type JiraNamedQueryParamName = (typeof JIRA_NAMED_QUERY_PARAM_NAMES)[number];

export type JiraNamedQueryParams = Readonly<Partial<Record<JiraNamedQueryParamName, string>>>;

/** Jira account ID shown on Jackie's office screen. */
export const JIRA_OFFICE_JACKIE_ACCOUNT_ID = '6170ed0ef6da6a006aa38240';

/** Jira account ID shown on Julie's office screen. */
export const JIRA_OFFICE_JULIE_ACCOUNT_ID = '70121:35744a1b-356c-45c7-8a12-156352d60ddb';

/**
 * The only assignees `office-assigned-active` will search for. A new office screen adds its
 * account ID here.
 */
export const JIRA_OFFICE_ASSIGNEE_ACCOUNT_IDS: ReadonlySet<string> = new Set([
  JIRA_OFFICE_JACKIE_ACCOUNT_ID,
  JIRA_OFFICE_JULIE_ACCOUNT_ID,
]);
