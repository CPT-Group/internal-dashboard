/**
 * Jira updates API – fetch issues updated since a timestamp.
 * Used for 30-min polling: run fetchUpdates(lastCheck), merge or refresh, then set lastCheck = now.
 */

import type { JiraIssue } from '@/types';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import { filterIssuesNovaMinKey } from '@/utils/jiraNovaFilter';
import { JIRA_SEARCH_MAX_RESULTS } from '@/constants';
import { formatJqlDateTime } from './jql';

export interface FetchUpdatesResult {
  issues: JiraIssue[];
  total: number;
  /** Timestamp to use as "since" for the next poll (e.g. pass to next fetchUpdates). */
  fetchedAt: Date;
}

/**
 * Fetch tickets updated since the given time (for incremental / polling).
 * Use with a 30-min interval: call with lastCheck, then set lastCheck = result.fetchedAt for next run.
 * Result issues are filtered to NOVA-661+.
 */
export async function fetchUpdates(since: Date | string): Promise<FetchUpdatesResult> {
  const { issues, total } = await jiraSearch('nova-updated-since', JIRA_SEARCH_MAX_RESULTS, undefined, {
    since: formatJqlDateTime(since),
  });
  const filtered = filterIssuesNovaMinKey(issues);
  return {
    issues: filtered,
    total: filtered.length,
    fetchedAt: new Date(),
  };
}
