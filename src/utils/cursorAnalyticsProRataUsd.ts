import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';

/** Sum of per-member `spendCents` for the current cycle (integer cents from Admin API). */
export function cycleSpendCentsTotal(billing: CursorBillingSnapshot | undefined): number | null {
  if (!billing?.spend.ok) return null;
  return billing.spend.data.members.reduce((s, m) => s + m.spendCents, 0);
}

export function cycleSpendUsdTotal(billing: CursorBillingSnapshot | undefined): number | null {
  const c = cycleSpendCentsTotal(billing);
  if (c == null) return null;
  return c / 100;
}

/** Spread `poolUsd` across rows by `weight / totalWeight` (returns `null` when not computable). */
export function proRataUsd(weight: number, totalWeight: number, poolUsd: number): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(totalWeight) || !Number.isFinite(poolUsd)) return null;
  if (totalWeight <= 0 || poolUsd <= 0) return null;
  return (weight / totalWeight) * poolUsd;
}
