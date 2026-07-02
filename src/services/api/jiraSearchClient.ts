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

export interface WorkHoursTodayData {
  byAuthorSeconds: Map<string, number>;
  byIssueByAuthorSeconds: Map<string, Map<string, number>>;
}

/** The /api/jira/transitions route caps each request at 200 issue keys. */
const JIRA_TRANSITIONS_MAX_KEYS_PER_REQUEST = 200;

/**
 * Fetch transition dates (FROM "New") for a set of issue keys.
 * Returns a map of issueKey → ISO date string.
 *
 * The endpoint caps each request at 200 keys, so we chunk (the tracked-ticket count can exceed
 * 200) and fetch batches concurrently, then merge. This is data-identical to a single request:
 * each key's transition date is independent, and merging the per-batch maps yields exactly the
 * same key→date set.
 */
export async function jiraTransitionDates(
  keys: string[]
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();

  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += JIRA_TRANSITIONS_MAX_KEYS_PER_REQUEST) {
    batches.push(keys.slice(i, i + JIRA_TRANSITIONS_MAX_KEYS_PER_REQUEST));
  }

  const perBatch = await Promise.all(
    batches.map(async (batch): Promise<Array<[string, string]>> => {
      const q = new URLSearchParams();
      q.set('keys', batch.join(','));
      const res = await fetch(`/api/jira/transitions?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
      return Object.entries(json.transitions ?? {}) as Array<[string, string]>;
    })
  );

  const merged = new Map<string, string>();
  for (const entries of perBatch) {
    for (const [key, date] of entries) merged.set(key, date);
  }
  return merged;
}

/**
 * Fetch total seconds logged today per account ID from Jira worklogs.
 * Returns Map<accountId, totalSeconds>.
 */
export async function fetchWorkHoursToday(
  accountIds: string[]
): Promise<WorkHoursTodayData> {
  const q = new URLSearchParams();
  q.set('accountIds', accountIds.join(','));
  const res = await fetch(`/api/jira/worklogs-today?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  const byAuthorSeconds = new Map(
    Object.entries(json.hours ?? {}).map(([id, secs]) => [id, Number(secs)])
  );
  const byIssueByAuthorSeconds = new Map<string, Map<string, number>>(
    Object.entries(json.hoursByIssue ?? {}).map(([issueKey, byAuthorRaw]) => {
      const byAuthorObject =
        byAuthorRaw && typeof byAuthorRaw === 'object'
          ? (byAuthorRaw as Record<string, number>)
          : {};
      const byAuthorMap = new Map(
        Object.entries(byAuthorObject).map(([accountId, seconds]) => [
          accountId,
          Number(seconds),
        ])
      );
      return [issueKey, byAuthorMap];
    })
  );
  return { byAuthorSeconds, byIssueByAuthorSeconds };
}

export async function jiraSearch(
  jql: string,
  maxResults: number = JIRA_SEARCH_MAX_RESULTS,
  fields?: readonly string[]
): Promise<JiraSearchClientResult> {
  const q = new URLSearchParams();
  q.set('jql', jql);
  q.set('maxResults', String(maxResults));
  if (fields?.length) {
    q.set('fields', fields.join(','));
  }
  const res = await fetch(`/api/jira/search?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  const issues = (json.issues ?? []) as JiraIssue[];
  const total = typeof json.total === 'number' ? json.total : issues.length;
  return { issues, total };
}
