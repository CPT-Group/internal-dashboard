import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';
import type { CursorBillingStoreStatus } from '@/lib/cursorBillingStore';

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

/** True when billing store does not have complete shards for the requested range. */
export function isCursorBillingStoreIncomplete(store: CursorBillingStoreStatus | undefined): boolean {
  if (!store) return true;
  const { coverage } = store;
  if (coverage.daysTotal === 0) return true;
  return coverage.daysComplete < coverage.daysTotal;
}

/** Block misleading dollar charts when API mode lacks complete charged-event coverage. */
export function shouldBlockApiMonetaryCharts(
  billing: CursorBillingSnapshot | undefined,
  billingStore: CursorBillingStoreStatus | undefined,
): boolean {
  if (isCursorBillingStoreIncomplete(billingStore)) return true;
  return isCursorChargedByDayTruncated(billing);
}
