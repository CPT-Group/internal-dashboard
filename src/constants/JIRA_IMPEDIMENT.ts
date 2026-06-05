/**
 * Jira impediment visibility — tickets flagged in Jira.
 */

/** Jira custom field id for "Flagged" (multi-checkbox). */
export const JIRA_FLAGGED_FIELD_ID = 'customfield_10021' as const;
/** Option value used by Jira's built-in flag field for impediments. */
export const JIRA_FLAGGED_IMPEDIMENT_VALUE = 'Impediment' as const;
/** JQL fragment for flagged impediments. */
export const JIRA_IMPEDIMENT_FLAGGED_JQL = `"Flagged" = ${JIRA_FLAGGED_IMPEDIMENT_VALUE}`;

/** Fields for impediment searches (issuelinks + attribution). */
export const JIRA_IMPEDIMENT_SEARCH_FIELDS = [
  'summary',
  'status',
  'project',
  'assignee',
  'reporter',
  'created',
  'updated',
  'issuetype',
  JIRA_FLAGGED_FIELD_ID,
  'customfield_10193',
  'components',
  'customfield_10754',
] as const;

/**
 * Open flagged impediments from delivery projects.
 */
export const JIRA_IMPEDIMENT_LINK_CARRIERS_JQL =
  `(project = NOVA AND ${JIRA_IMPEDIMENT_FLAGGED_JQL} AND statusCategory != Done) ORDER BY updated DESC`;
