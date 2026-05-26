/** When set (non-empty), `/cursor-analytics` and `/api/cursor-analytics/*` require login. */
export const CURSOR_ANALYTICS_AUTH_COOKIE = 'cursor-analytics-auth';

/** Cookie value set after successful password check (not the password itself). */
export const CURSOR_ANALYTICS_AUTH_SESSION = 'nova';

export function getCursorAnalyticsPassword(): string | null {
  const raw = process.env.CURSOR_ANALYTICS_PASSWORD?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function isCursorAnalyticsPasswordProtectionEnabled(): boolean {
  return getCursorAnalyticsPassword() !== null;
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
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

export function isCursorAnalyticsAuthedFromCookieHeader(cookieHeader: string | null): boolean {
  if (!isCursorAnalyticsPasswordProtectionEnabled()) {
    return true;
  }
  const value = readCookieValue(cookieHeader, CURSOR_ANALYTICS_AUTH_COOKIE);
  return value === CURSOR_ANALYTICS_AUTH_SESSION;
}
