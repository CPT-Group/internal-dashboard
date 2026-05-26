import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  CURSOR_ANALYTICS_AUTH_COOKIE,
  CURSOR_ANALYTICS_AUTH_SESSION,
  getCursorAnalyticsPassword,
  isCursorAnalyticsAuthedFromCookieHeader,
} from '@/lib/cursorAnalyticsAuth';

export function middleware(request: NextRequest) {
  const password = getCursorAnalyticsPassword();
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === '/api/cursor-analytics/auth') {
    return NextResponse.next();
  }

  const cookieHeader = request.headers.get('cookie');
  if (isCursorAnalyticsAuthedFromCookieHeader(cookieHeader)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/cursor-analytics')) {
    return NextResponse.json(
      { ok: false, message: 'Cursor analytics password required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (pathname.startsWith('/cursor-analytics')) {
    if (pathname === '/cursor-analytics/login') {
      return NextResponse.next();
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/cursor-analytics/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/cursor-analytics/:path*', '/api/cursor-analytics/:path*'],
};
