import {
  DASHBOARD_CURSOR_ANALYTICS_VIEW,
  hasDashboardPermission,
} from '@/constants/rbac/dashboard-permissions';
import { isEntraAuthConfigured } from '@/lib/entraConfig';
import {
  readCursorAnalyticsSessionFromCookieHeader,
  type CursorAnalyticsSession,
} from '@/lib/cursorAnalyticsSession';

export { CURSOR_ANALYTICS_AUTH_COOKIE } from '@/lib/cursorAnalyticsSession';

/** When Entra env is complete, cursor analytics routes require a valid session. */
export function isCursorAnalyticsAuthRequired(): boolean {
  return isEntraAuthConfigured();
}

export async function getCursorAnalyticsSessionFromCookieHeader(
  cookieHeader: string | null,
): Promise<CursorAnalyticsSession | null> {
  if (!isCursorAnalyticsAuthRequired()) return null;
  return readCursorAnalyticsSessionFromCookieHeader(cookieHeader);
}

export function sessionHasCursorAnalyticsPermission(session: CursorAnalyticsSession | null): boolean {
  if (!session) return false;
  return hasDashboardPermission(session.roles, DASHBOARD_CURSOR_ANALYTICS_VIEW);
}

export async function isCursorAnalyticsAuthedFromCookieHeader(cookieHeader: string | null): Promise<boolean> {
  if (!isCursorAnalyticsAuthRequired()) return false;
  const session = await getCursorAnalyticsSessionFromCookieHeader(cookieHeader);
  return sessionHasCursorAnalyticsPermission(session);
}
