import { sfFetchWithStoredToken } from '@/services/api/salesforceOAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sf/whoami
 * Calls Salesforce /services/oauth2/userinfo to confirm stored token works.
 */
export async function GET() {
  const userinfo = await sfFetchWithStoredToken<Record<string, unknown>>(
    '/services/oauth2/userinfo'
  );
  return Response.json({
    success: true,
    userinfo,
    message: 'Token valid.',
  });
}
