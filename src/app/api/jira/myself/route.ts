import { getMyself } from '@/services/api/jiraService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getMyself();
    return Response.json({ success: true, ...user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Jira auth failed';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
