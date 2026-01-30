/**
 * Jira REST API v3 client (server-side only).
 * Uses Basic auth with KYLE_EMAIL + KYLE_JIRA_TOKEN from env.
 * Only import in API route handlers (app/api/jira/*).
 *
 * @see https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/#about
 */

import type { JiraSearchParams, JiraSearchResponse } from '@/types';

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
 * Search issues using JQL (server-side only).
 * Uses POST /rest/api/3/search/jql (legacy GET /search was removed).
 */
export async function searchIssues(
  params: JiraSearchParams
): Promise<JiraSearchResponse> {
  const { jql, maxResults = 50, fields, expand } = params;
  const body: Record<string, string | number | string[] | undefined> = {
    jql,
    maxResults,
    fields: fields?.length ? fields : [...DEFAULT_JIRA_FIELDS],
  };
  if (expand) body.expand = expand;

  const raw = await jiraFetch<{ isLast?: boolean; issues?: JiraSearchResponse['issues'] }>(
    '/search/jql',
    { method: 'POST', body: JSON.stringify(body) }
  );
  const issues = raw.issues ?? [];
  return {
    startAt: 0,
    maxResults,
    total: issues.length,
    issues,
  };
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
