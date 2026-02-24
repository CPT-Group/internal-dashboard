/**
 * Helpers to restrict NOVA dashboards to recent issues only (e.g. NOVA-661+).
 * JQL cannot filter by numeric key range, so we filter client-side after fetch.
 */

import type { JiraIssue } from '@/types';
import { JIRA_NOVA_MIN_ISSUE_NUM } from '@/constants';

/** Parse issue number from key (e.g. "NOVA-661" -> 661). Returns null if not parseable. */
export function getIssueNumberFromKey(key: string): number | null {
  if (!key || typeof key !== 'string') return null;
  const dash = key.indexOf('-');
  if (dash === -1) return null;
  const num = parseInt(key.slice(dash + 1), 10);
  return Number.isNaN(num) ? null : num;
}

/** Project key from issue (e.g. NOVA, OPRD, CM). */
function getProjectKey(issue: JiraIssue): string {
  return issue.fields?.project?.key ?? '';
}

/**
 * True if issue should be included for NOVA min-key filtering:
 * - Non-NOVA projects: always include.
 * - NOVA: include only when issue number >= minKeyNum.
 */
export function shouldIncludeNovaMinKey(
  issue: JiraIssue,
  minKeyNum: number = JIRA_NOVA_MIN_ISSUE_NUM
): boolean {
  const project = getProjectKey(issue);
  if (project !== 'NOVA') return true;
  const num = getIssueNumberFromKey(issue.key);
  return num != null && num >= minKeyNum;
}

/** Filter to only issues we care about: non-NOVA kept; NOVA only if key >= minKeyNum. */
export function filterIssuesNovaMinKey(
  issues: JiraIssue[],
  minKeyNum: number = JIRA_NOVA_MIN_ISSUE_NUM
): JiraIssue[] {
  return issues.filter((i) => shouldIncludeNovaMinKey(i, minKeyNum));
}
