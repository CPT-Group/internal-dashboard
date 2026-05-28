/**
 * Jira impediment visibility — issue-link "Blocks" / "is blocked by".
 * Discovery: scripts/jira/discover-impediment-links.mjs (2026-05).
 */

/** Link type names that count as a delivery blocker (outward = blocks, inward = is blocked by). */
export const JIRA_BLOCKS_LINK_TYPE_NAMES = ['Blocks'] as const;

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
  'issuelinks',
  'customfield_10193',
  'components',
  'customfield_10754',
] as const;

/**
 * Open issues that may carry "Blocks" links (blockers or blocked stories).
 * Wider than board filter so blockers outside the sprint assignee scope still appear.
 */
export const JIRA_IMPEDIMENT_LINK_CARRIERS_JQL =
  `(project = NOVA AND statusCategory != Done) OR (project = CM AND statusCategory != Done) OR (project = OPRD AND statusCategory != Done) OR (project = IT AND statusCategory != Done) ORDER BY updated DESC`;
