import { NextResponse } from 'next/server';

import {
  DASHBOARD_CURSOR_ANALYTICS_VIEW,
  hasDashboardPermission,
} from '@/constants/rbac/dashboard-permissions';
import { auditCursorAnalyticsAccess } from '@/lib/cursorAnalyticsAudit';
import {
  getCursorAnalyticsSessionFromCookieHeader,
  isCursorAnalyticsAuthRequired,
  sessionHasCursorAnalyticsPermission,
} from '@/lib/cursorAnalyticsAuth';
import {
  authCookieOptions,
  createCursorAnalyticsSessionToken,
  CURSOR_ANALYTICS_AUTH_COOKIE,
} from '@/lib/cursorAnalyticsSession';
import { validateEntraAccessToken } from '@/lib/entraJwt';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const required = isCursorAnalyticsAuthRequired();
  const session = await getCursorAnalyticsSessionFromCookieHeader(request.headers.get('cookie'));
  const authenticated = sessionHasCursorAnalyticsPermission(session);

  if (required && session && !authenticated) {
    auditCursorAnalyticsAccess({
      outcome: 'deny',
      session,
      path: url.pathname,
      method: 'GET',
      reason: 'missing_permission',
    });
  }

  return NextResponse.json(
    {
      required,
      authenticated,
      permission: DASHBOARD_CURSOR_ANALYTICS_VIEW,
      user: authenticated && session
        ? { oid: session.oid, name: session.name, email: session.email }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface AuthBody {
  accessToken?: string;
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (!isCursorAnalyticsAuthRequired()) {
    auditCursorAnalyticsAccess({
      outcome: 'misconfigured',
      session: null,
      path: url.pathname,
      method: 'POST',
      reason: 'entra_not_configured',
    });
    return NextResponse.json(
      { ok: false, message: 'Entra auth is not configured. Access denied (fail closed).' },
      { status: 503 },
    );
  }

  let body: AuthBody = {};
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
  if (!accessToken) {
    return NextResponse.json({ ok: false, message: 'accessToken is required.' }, { status: 400 });
  }

  const validated = await validateEntraAccessToken(accessToken);
  if (!validated) {
    auditCursorAnalyticsAccess({
      outcome: 'deny',
      session: null,
      path: url.pathname,
      method: 'POST',
      reason: 'invalid_token',
    });
    return NextResponse.json({ ok: false, message: 'Invalid or expired Microsoft token.' }, { status: 401 });
  }

  if (!hasDashboardPermission(validated.roles, DASHBOARD_CURSOR_ANALYTICS_VIEW)) {
    auditCursorAnalyticsAccess({
      outcome: 'deny',
      session: {
        oid: validated.oid,
        name: validated.name,
        email: validated.email,
        roles: validated.roles,
      },
      path: url.pathname,
      method: 'POST',
      reason: 'missing_permission',
    });
    return NextResponse.json(
      {
        ok: false,
        message: `Missing required permission: ${DASHBOARD_CURSOR_ANALYTICS_VIEW}.`,
      },
      { status: 403 },
    );
  }

  const sessionToken = await createCursorAnalyticsSessionToken({
    oid: validated.oid,
    name: validated.name,
    email: validated.email,
    roles: validated.roles,
  });
  if (!sessionToken) {
    auditCursorAnalyticsAccess({
      outcome: 'misconfigured',
      session: null,
      path: url.pathname,
      method: 'POST',
      reason: 'session_sign_failed',
    });
    return NextResponse.json({ ok: false, message: 'Session could not be created.' }, { status: 503 });
  }

  const session = {
    oid: validated.oid,
    name: validated.name,
    email: validated.email,
    roles: validated.roles,
  };

  auditCursorAnalyticsAccess({
    outcome: 'allow',
    session,
    path: url.pathname,
    method: 'POST',
    reason: 'login_success',
  });

  const res = NextResponse.json({
    ok: true,
    required: true,
    user: { oid: session.oid, name: session.name, email: session.email },
  });
  res.cookies.set(CURSOR_ANALYTICS_AUTH_COOKIE, sessionToken, authCookieOptions());
  return res;
}

export async function DELETE(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CURSOR_ANALYTICS_AUTH_COOKIE, '', { ...authCookieOptions(), maxAge: 0 });
  return res;
}
