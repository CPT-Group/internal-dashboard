import { jwtVerify, SignJWT } from 'jose';

import { getEntraAuthConfig } from '@/lib/entraConfig';

export const CURSOR_ANALYTICS_AUTH_COOKIE = 'cursor-analytics-auth';

export interface CursorAnalyticsSession {
  oid: string;
  name: string | null;
  email: string | null;
  roles: string[];
}

const SESSION_MAX_AGE_SEC = 60 * 60 * 8;

function sessionSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createCursorAnalyticsSessionToken(session: CursorAnalyticsSession): Promise<string | null> {
  const config = getEntraAuthConfig();
  if (!config) return null;

  return new SignJWT({
    oid: session.oid,
    name: session.name,
    email: session.email,
    roles: session.roles,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${String(SESSION_MAX_AGE_SEC)}s`)
    .sign(sessionSecretKey(config.sessionSecret));
}

export async function verifyCursorAnalyticsSessionToken(token: string | null | undefined): Promise<CursorAnalyticsSession | null> {
  const config = getEntraAuthConfig();
  if (!config || !token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecretKey(config.sessionSecret));
    const oid = typeof payload.oid === 'string' ? payload.oid : null;
    if (!oid) return null;
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((r): r is string => typeof r === 'string')
      : [];
    return {
      oid,
      name: typeof payload.name === 'string' ? payload.name : null,
      email: typeof payload.email === 'string' ? payload.email : null,
      roles,
    };
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return null;
}

export async function readCursorAnalyticsSessionFromCookieHeader(
  cookieHeader: string | null,
): Promise<CursorAnalyticsSession | null> {
  const token = readCookieValue(cookieHeader, CURSOR_ANALYTICS_AUTH_COOKIE);
  return verifyCursorAnalyticsSessionToken(token);
}

export function authCookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === 'production',
  };
}
