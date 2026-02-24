/**
 * Jira ticket API – fine-tuned calls for specific widgets.
 * All functions use the app's Jira search proxy and apply NOVA min-key filter (661+).
 */

import type { JiraIssue } from '@/types';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import { filterIssuesNovaMinKey } from '@/utils/jiraNovaFilter';
import { JIRA_SEARCH_MAX_RESULTS } from '@/constants';
import { jqlTicketsTransitionedToday, jqlTicketsCreatedToday } from './jql';

export interface TicketsTransitionedTodayResult {
  issues: JiraIssue[];
  total: number;
}

/**
 * Fetch tickets that were transitioned (resolved) today – i.e. moved to Done today.
 * Not "created today" – specifically resolutiondate >= startOfDay().
 */
export async function getTicketsTransitionedToday(): Promise<TicketsTransitionedTodayResult> {
  const jql = jqlTicketsTransitionedToday();
  const { issues, total } = await jiraSearch(jql, JIRA_SEARCH_MAX_RESULTS);
  const filtered = filterIssuesNovaMinKey(issues);
  return { issues: filtered, total: filtered.length };
}

export interface TicketsCreatedTodayResult {
  issues: JiraIssue[];
  total: number;
}

/** Fetch tickets created today (for "opened today" style widgets). */
export async function getTicketsCreatedToday(): Promise<TicketsCreatedTodayResult> {
  const jql = jqlTicketsCreatedToday();
  const { issues, total } = await jiraSearch(jql, JIRA_SEARCH_MAX_RESULTS);
  const filtered = filterIssuesNovaMinKey(issues);
  return { issues: filtered, total: filtered.length };
}
