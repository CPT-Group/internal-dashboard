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
