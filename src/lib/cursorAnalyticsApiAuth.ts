import { NextResponse } from 'next/server';

import {
  getCursorAnalyticsSessionFromCookieHeader,
  isCursorAnalyticsAuthRequired,
  sessionHasCursorAnalyticsPermission,
} from '@/lib/cursorAnalyticsAuth';
import { auditCursorAnalyticsAccess } from '@/lib/cursorAnalyticsAudit';

/** Defense-in-depth gate for cursor analytics API handlers (middleware is primary). */
export async function assertCursorAnalyticsApiAuthorized(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (!isCursorAnalyticsAuthRequired()) {
    auditCursorAnalyticsAccess({
      outcome: 'misconfigured',
      session: null,
      path: url.pathname,
      method: request.method,
      reason: 'entra_not_configured',
    });
    return NextResponse.json(
      { ok: false, message: 'Entra auth is not configured. Access denied (fail closed).' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const session = await getCursorAnalyticsSessionFromCookieHeader(request.headers.get('cookie'));
  if (!sessionHasCursorAnalyticsPermission(session)) {
    auditCursorAnalyticsAccess({
      outcome: 'deny',
      session,
      path: url.pathname,
      method: request.method,
      reason: session ? 'missing_permission' : 'no_session',
    });
    return NextResponse.json(
      {
        ok: false,
        message: session
          ? 'Missing dashboard.cursorAnalytics.view permission.'
          : 'Microsoft Entra sign-in required.',
      },
      { status: session ? 403 : 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  auditCursorAnalyticsAccess({
    outcome: 'allow',
    session,
    path: url.pathname,
    method: request.method,
    reason: 'api_access',
  });

  return null;
}
