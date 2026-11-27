import { NextRequest } from 'next/server';
import { searchIssues } from '@/services/api/jiraService';
import { notifyImpedimentFlaggedTeamsIfNeeded } from '@/services/jira/impediments';
import { resolveJiraNamedSearch } from '@/services/jira/namedQueries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/jira/search?query=<name>[&maxResults=<n>][&fields=a,b][&<declared param>=<value>]
 *
 * Runs ONE server-defined named query (src/services/jira/namedQueries.ts). Raw `jql`, unknown
 * names, undeclared parameters and fields outside the allowlist are refused with 400 before any
 * Jira call is made.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resolved = resolveJiraNamedSearch(searchParams);
  if (!resolved.ok) {
    return Response.json({ success: false, message: resolved.message }, { status: 400 });
  }

  try {
    const result = await searchIssues({
      jql: resolved.jql,
      maxResults: resolved.maxResults,
      fields: resolved.fields,
    });

    await notifyImpedimentFlaggedTeamsIfNeeded(result.issues);

    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira search failed';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
