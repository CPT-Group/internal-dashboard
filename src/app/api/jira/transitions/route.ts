import { NextRequest } from 'next/server';
import { getTransitionDatesFromNew } from '@/services/api/jiraService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jira/transitions?keys=CM-123,CM-456,...
 * Returns a map of issueKey → ISO date string for when each issue
 * transitioned FROM "New" status (first occurrence).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keysParam = searchParams.get('keys');

    if (!keysParam?.trim()) {
      return Response.json(
        { success: false, message: 'Missing required query: keys' },
        { status: 400 }
      );
    }

    const keys = keysParam.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
      return Response.json({ success: true, transitions: {} });
    }

    if (keys.length > 200) {
      return Response.json(
        { success: false, message: 'Max 200 keys per request' },
        { status: 400 }
      );
    }

    const dateMap = await getTransitionDatesFromNew(keys);
    const transitions: Record<string, string> = {};
    for (const [key, date] of dateMap) {
      transitions[key] = date;
    }

    return Response.json({ success: true, transitions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch transitions';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
