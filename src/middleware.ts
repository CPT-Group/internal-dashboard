import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  getCursorAnalyticsSessionFromCookieHeader,
  isCursorAnalyticsAuthRequired,
  isCursorAnalyticsAuthedFromCookieHeader,
  sessionHasCursorAnalyticsPermission,
} from '@/lib/cursorAnalyticsAuth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/cursor-analytics') && !pathname.startsWith('/api/cursor-analytics')) {
    return NextResponse.next();
  }

  if (pathname === '/api/cursor-analytics/auth') {
    return NextResponse.next();
  }

  if (!isCursorAnalyticsAuthRequired()) {
    if (pathname.startsWith('/api/cursor-analytics')) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Cursor analytics Entra auth is not configured. Access denied (fail closed).',
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (pathname.startsWith('/cursor-analytics')) {
      if (pathname === '/cursor-analytics/login') {
        return NextResponse.next();
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/cursor-analytics/login';
      loginUrl.searchParams.set('next', pathname);
      loginUrl.searchParams.set('error', 'misconfigured');
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie');
  const authed = await isCursorAnalyticsAuthedFromCookieHeader(cookieHeader);
  if (authed) {
    return NextResponse.next();
  }

  const session = await getCursorAnalyticsSessionFromCookieHeader(cookieHeader);
  const deniedMessage = session
    ? 'Signed in but missing dashboard.cursorAnalytics.view permission.'
    : 'Microsoft Entra sign-in required.';

  if (pathname.startsWith('/api/cursor-analytics')) {
    return NextResponse.json(
      { ok: false, message: deniedMessage },
      { status: session ? 403 : 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (pathname.startsWith('/cursor-analytics')) {
    if (pathname === '/cursor-analytics/login') {
      return NextResponse.next();
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/cursor-analytics/login';
    loginUrl.searchParams.set('next', pathname);
    if (session && !sessionHasCursorAnalyticsPermission(session)) {
      loginUrl.searchParams.set('error', 'forbidden');
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/cursor-analytics/:path*', '/api/cursor-analytics/:path*'],
};
