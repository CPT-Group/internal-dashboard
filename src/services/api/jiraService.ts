/**
 * Jira REST API v3 client (server-side only).
 * Uses Basic auth with KYLE_EMAIL + KYLE_JIRA_TOKEN from env.
 * Only import in API route handlers (app/api/jira/*).
 *
 * @see https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#about
 */

import type { JiraSearchParams, JiraSearchV3Raw, JiraSearchResponse } from '@/types';

const JIRA_REST_PREFIX = '/rest/api/3';

/** Default fields for analytics (full ticket data). */
const DEFAULT_JIRA_FIELDS = [
  'summary',
  'status',
  'project',
  'assignee',
  'created',
  'updated',
  'issuetype',
  'priority',
  'duedate',
  'resolutiondate',
  'components',
  'customfield_10193', // Tech Owner (user who actually does the dev work)
] as const;

function getJiraConfig(): { baseUrl: string; authHeader: string } {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.KYLE_EMAIL;
  const token = process.env.KYLE_JIRA_TOKEN;

  if (!baseUrl?.trim()) {
    throw new Error('JIRA_BASE_URL is not set');
  }
  if (!email?.trim() || !token?.trim()) {
    throw new Error('KYLE_EMAIL and KYLE_JIRA_TOKEN are required for Jira API');
  }

  const encoded = Buffer.from(`${email}:${token}`).toString('base64');
  const authHeader = `Basic ${encoded}`;

  return { baseUrl: baseUrl.replace(/\/$/, ''), authHeader };
}

async function jiraFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { baseUrl, authHeader } = getJiraConfig();
  const url = `${baseUrl}${JIRA_REST_PREFIX}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `Jira API error ${response.status}: ${response.statusText}`;
    try {
      const err = JSON.parse(body);
      if (err.errorMessages?.length) message = err.errorMessages.join('; ');
      else if (err.errors && typeof err.errors === 'object') {
        message = Object.entries(err.errors).map(([k, v]) => `${k}: ${v}`).join('; ');
      }
    } catch {
      if (body) message += ` - ${body.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch a single page from POST /rest/api/3/search/jql (v3 cursor-based pagination).
 */
async function searchPage(
  jql: string,
  maxResults: number,
  fields: string[],
  nextPageToken?: string,
  expand?: string
): Promise<JiraSearchV3Raw> {
  const body: Record<string, string | number | string[] | undefined> = {
    jql,
    maxResults,
    fields,
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;
  if (expand) body.expand = expand;

  return jiraFetch<JiraSearchV3Raw>('/search/jql', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const MAX_PAGES = 10;
const PAGE_SIZE = 100;

/**
 * Search issues using JQL with auto-pagination (server-side only).
 * Fetches up to maxResults issues, paginating with nextPageToken.
 * V3 /search/jql does not return a total count; total = fetched count.
 */
export async function searchIssues(
  params: JiraSearchParams
): Promise<JiraSearchResponse> {
  const { jql, maxResults = 100, fields, expand } = params;
  const fieldList = fields?.length ? fields : [...DEFAULT_JIRA_FIELDS];
  const perPage = Math.min(maxResults, PAGE_SIZE);

  const allIssues: JiraSearchResponse['issues'] = [];
  let token: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const remaining = maxResults - allIssues.length;
    if (remaining <= 0) break;

    const raw = await searchPage(
      jql,
      Math.min(perPage, remaining),
      fieldList,
      token,
      expand
    );

    allIssues.push(...(raw.issues ?? []));

    if (raw.isLast || !raw.nextPageToken) break;
    token = raw.nextPageToken;
  }

  return { total: allIssues.length, issues: allIssues };
}

/** Single changelog history entry from Jira. */
export interface JiraChangelogItem {
  field: string;
  fromString: string | null;
  toString: string | null;
}

export interface JiraChangelogHistory {
  created: string;
  items: JiraChangelogItem[];
}

/**
 * Fetch changelog for a single issue. Returns status transitions only.
 * Uses GET /rest/api/3/issue/{key}/changelog.
 */
export async function getIssueChangelog(
  issueKey: string
): Promise<JiraChangelogHistory[]> {
  const raw = await jiraFetch<{
    values?: JiraChangelogHistory[];
  }>(`/issue/${issueKey}/changelog?maxResults=100`);
  return (raw.values ?? []).filter((h) =>
    h.items.some((item) => item.field === 'status')
  );
}

/**
 * Batch-fetch changelogs for multiple issues. Returns a map of issueKey → transition date
 * (ISO string) for the FIRST transition FROM "New" status. Concurrency-limited.
 */
export async function getTransitionDatesFromNew(
  issueKeys: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < issueKeys.length; i += BATCH_SIZE) {
    const batch = issueKeys.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (key) => {
        const histories = await getIssueChangelog(key);
        for (const h of histories) {
          for (const item of h.items) {
            if (item.field === 'status' && item.fromString === 'New') {
              return { key, date: h.created };
            }
          }
        }
        return null;
      })
    );
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        result.set(s.value.key, s.value.date);
      }
    }
  }

  return result;
}

// ── Worklogs ──

interface JiraWorklog {
  author: { accountId: string; displayName: string };
  started: string;
  timeSpentSeconds: number;
  timeSpent: string;
}

interface JiraWorklogResponse {
  worklogs: JiraWorklog[];
  total: number;
}

/**
 * Fetch total seconds logged *today* (Pacific time) for each account ID.
 *
 * 1. JQL `worklogDate >= startOfDay() AND worklogAuthor in (...)` to find issues.
 * 2. For each issue, GET /issue/{key}/worklog → filter by today + author.
 * 3. Sum timeSpentSeconds per author.
 *
 * Returns Map<accountId, totalSeconds>.
 */
export async function getWorklogsToday(
  accountIds: string[]
): Promise<Map<string, number>> {
  const authorList = accountIds.map((id) => `"${id}"`).join(', ');
  const jql = `worklogDate >= startOfDay() AND worklogAuthor in (${authorList})`;

  const searchResult = await searchIssues({ jql, maxResults: 100, fields: ['key'] });

  const todayPacific = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles',
  });
  const accountIdSet = new Set(accountIds);
  const secondsByAuthor = new Map<string, number>();

  const BATCH_SIZE = 10;
  for (let i = 0; i < searchResult.issues.length; i += BATCH_SIZE) {
    const batch = searchResult.issues.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (issue) => {
        const wl = await jiraFetch<JiraWorklogResponse>(
          `/issue/${issue.key}/worklog`
        );
        return wl.worklogs ?? [];
      })
    );

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const wl of result.value) {
        const startedDate = wl.started?.slice(0, 10);
        const authorId = wl.author?.accountId;
        if (startedDate === todayPacific && accountIdSet.has(authorId)) {
          const prev = secondsByAuthor.get(authorId) ?? 0;
          secondsByAuthor.set(authorId, prev + (wl.timeSpentSeconds ?? 0));
        }
      }
    }
  }

  return secondsByAuthor;
}

/**
 * Get current user (verify credentials, server-side only).
 */
export async function getMyself(): Promise<{
  accountId: string;
  displayName: string;
  emailAddress?: string;
}> {
  const data = await jiraFetch<{
    accountId: string;
    displayName: string;
    emailAddress?: string;
  }>('/myself');
  return data;
}
