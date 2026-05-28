import type { JiraIssue } from '@/types';

export function getAssigneeName(issue: JiraIssue): string {
  return issue.fields?.assignee?.displayName ?? 'Unassigned';
}

export function getReporterName(issue: JiraIssue): string {
  return issue.fields?.reporter?.displayName?.trim() || '—';
}

/** Tech Owner, else assignee display name. */
export function getTechOwnerName(issue: JiraIssue): string {
  return issue.fields?.customfield_10193?.displayName ?? getAssigneeName(issue);
}

export function getTechOwnerAccountId(issue: JiraIssue): string | null {
  return issue.fields?.customfield_10193?.accountId
    ?? issue.fields?.assignee?.accountId
    ?? null;
}
