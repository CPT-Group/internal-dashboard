import { NextResponse } from 'next/server';
import { getWorklogsToday } from '@/services/api/jiraService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('accountIds')?.split(',').filter(Boolean) ?? [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'accountIds query param required' }, { status: 400 });
  }

  try {
    const result = await getWorklogsToday(ids);
    const hours: Record<string, number> = {};
    for (const [id, seconds] of result.secondsByAuthor) {
      hours[id] = seconds;
    }
    const hoursByIssue: Record<string, Record<string, number>> = {};
    for (const [issueKey, byAuthor] of result.secondsByIssueByAuthor) {
      hoursByIssue[issueKey] = {};
      for (const [accountId, seconds] of byAuthor) {
        hoursByIssue[issueKey][accountId] = seconds;
      }
    }
    return NextResponse.json({ hours, hoursByIssue });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch worklogs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
