import { NextResponse } from 'next/server';

import {
  CURSOR_ANALYTICS_AUTH_COOKIE,
  CURSOR_ANALYTICS_AUTH_SESSION,
  getCursorAnalyticsPassword,
  isCursorAnalyticsAuthedFromCookieHeader,
  isCursorAnalyticsPasswordProtectionEnabled,
} from '@/lib/cursorAnalyticsAuth';
import { verifyCursorAnalyticsPassword } from '@/lib/cursorAnalyticsAuthServer';

export const dynamic = 'force-dynamic';

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

function authCookieOptions(): { httpOnly: true; sameSite: 'lax'; path: string; maxAge: number; secure: boolean } {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function GET(request: Request): Promise<Response> {
  const required = isCursorAnalyticsPasswordProtectionEnabled();
  const authenticated = isCursorAnalyticsAuthedFromCookieHeader(request.headers.get('cookie'));
  return NextResponse.json(
    { required, authenticated },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

interface AuthBody {
  password?: string;
}

export async function POST(request: Request): Promise<Response> {
  if (!isCursorAnalyticsPasswordProtectionEnabled()) {
    return NextResponse.json({ ok: true, required: false });
  }

  let body: AuthBody = {};
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body.' }, { status: 400 });
  }

  const candidate = typeof body.password === 'string' ? body.password : '';
  if (!verifyCursorAnalyticsPassword(candidate)) {
    return NextResponse.json({ ok: false, message: 'Incorrect password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, required: true });
  res.cookies.set(CURSOR_ANALYTICS_AUTH_COOKIE, CURSOR_ANALYTICS_AUTH_SESSION, authCookieOptions());
  return res;
}

export async function DELETE(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  if (getCursorAnalyticsPassword()) {
    res.cookies.set(CURSOR_ANALYTICS_AUTH_COOKIE, '', { ...authCookieOptions(), maxAge: 0 });
  }
  return res;
}
