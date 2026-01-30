import { NextRequest } from 'next/server';
import { searchIssues } from '@/services/api/jiraService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jql = searchParams.get('jql');
    const maxResults = searchParams.get('maxResults');
    const startAt = searchParams.get('startAt');
    const fieldsParam = searchParams.get('fields');

    if (!jql?.trim()) {
      return Response.json(
        { success: false, message: 'Missing required query: jql' },
        { status: 400 }
      );
    }

    const fields = fieldsParam
      ? fieldsParam.split(',').map((f) => f.trim()).filter(Boolean)
      : undefined;

    const result = await searchIssues({
      jql: jql.trim(),
      maxResults: maxResults ? Math.min(Number(maxResults), 100) : 50,
      startAt: startAt ? Number(startAt) : 0,
      fields: fields?.length ? fields : undefined,
    });

    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira search failed';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
