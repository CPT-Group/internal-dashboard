import { timingSafeEqual } from 'node:crypto';

import { getCursorAnalyticsPassword } from '@/lib/cursorAnalyticsAuth';

/** Constant-time compare for the shared team password (Node route handlers only). */
export function verifyCursorAnalyticsPassword(candidate: string): boolean {
  const expected = getCursorAnalyticsPassword();
  if (!expected) return true;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
