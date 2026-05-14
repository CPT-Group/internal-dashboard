import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';

/** True when usage-event pagination may not cover all API-reported rows. */
export function isCursorChargedByDayTruncated(billing: CursorBillingSnapshot | undefined): boolean {
  if (billing?.chargedByDay.ok !== true) return false;
  const d = billing.chargedByDay.data;
  if (d.truncated) return true;
  const total = d.usageEventsTotalReported;
  const read = d.usageEventRowsReturned;
  if (typeof total === 'number' && total > 0 && typeof read === 'number' && read < total) {
    return true;
  }
  return false;
}
