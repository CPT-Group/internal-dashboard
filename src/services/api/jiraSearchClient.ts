/**
 * Client-side Jira search. Calls Next.js API route /api/jira/search.
 * Used by Jira dashboard stores (Nova, Trevor, etc.) so fetch logic lives in one place.
 */

import type { JiraIssue } from '@/types';
import { JIRA_SEARCH_MAX_RESULTS } from '@/constants';

export interface JiraSearchClientResult {
  issues: JiraIssue[];
  total: number;
}

/**
 * Fetch transition dates (FROM "New") for a batch of issue keys.
 * Returns a map of issueKey → ISO date string.
 */
export async function jiraTransitionDates(
  keys: string[]
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const q = new URLSearchParams();
  q.set('keys', keys.join(','));
  const res = await fetch(`/api/jira/transitions?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return new Map(Object.entries(json.transitions ?? {}));
}

/**
 * Fetch total seconds logged today per account ID from Jira worklogs.
 * Returns Map<accountId, totalSeconds>.
 */
export async function fetchWorkHoursToday(
  accountIds: string[]
): Promise<Map<string, number>> {
  const q = new URLSearchParams();
  q.set('accountIds', accountIds.join(','));
  const res = await fetch(`/api/jira/worklogs-today?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return new Map(
    Object.entries(json.hours ?? {}).map(([id, secs]) => [id, Number(secs)])
  );
}

export async function jiraSearch(
  jql: string,
  maxResults: number = JIRA_SEARCH_MAX_RESULTS
): Promise<JiraSearchClientResult> {
  const q = new URLSearchParams();
  q.set('jql', jql);
  q.set('maxResults', String(maxResults));
  const res = await fetch(`/api/jira/search?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  const issues = (json.issues ?? []) as JiraIssue[];
  const total = typeof json.total === 'number' ? json.total : issues.length;
  return { issues, total };
}
