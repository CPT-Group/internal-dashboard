import type { CursorAnalyticsSummary } from '@/types/cursorAnalytics';

import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';

/** Sum model-estimate cents per `YYYY-MM` for ISO days inside `range`. */
export function monthTotalsCentsFromByDay(
  byDayCents: Record<string, number>,
  range: { startDate: string; endDate: string },
): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of eachIsoDayInclusive(range.startDate, range.endDate)) {
    const mk = d.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mk)) continue;
    const c = byDayCents[d] ?? 0;
    if (!Number.isFinite(c) || c <= 0) continue;
    map.set(mk, (map.get(mk) ?? 0) + c);
  }
  return map;
}

export interface CsvMonthDeveloperEstimateRow {
  month: string;
  developer: string;
  chargedCents: number;
}

/**
 * When the merged summary includes **tabular** `byMonthDeveloper` (month×user activity), spread each calendar
 * month’s **model-derived** estimated cents (from daily estimates in range) across developers in proportion to
 * that month’s tabular `amount` — same idea as repo AI-lines share. Team rollup alone has no `byMonthDeveloper`.
 */
export function buildCsvMonthDeveloperEstimateRows(
  summary: CursorAnalyticsSummary,
  range: { startDate: string; endDate: string },
  byDayCents: Record<string, number>,
): CsvMonthDeveloperEstimateRow[] {
  const monthCents = monthTotalsCentsFromByDay(byDayCents, range);
  if (monthCents.size === 0) return [];

  const byMonth = new Map<string, { developer: string; amount: number }[]>();
  for (const [key, bucket] of Object.entries(summary.byMonthDeveloper)) {
    const tab = key.indexOf('\t');
    if (tab < 0) continue;
    const month = key.slice(0, tab);
    const developer = key.slice(tab + 1).trim();
    if (!/^\d{4}-\d{2}$/.test(month) || !developer) continue;
    const amount = bucket.amount;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if ((monthCents.get(month) ?? 0) <= 0) continue;
    const list = byMonth.get(month) ?? [];
    list.push({ developer, amount });
    byMonth.set(month, list);
  }

  const out: CsvMonthDeveloperEstimateRow[] = [];
  for (const [month, list] of byMonth) {
    const pool = monthCents.get(month) ?? 0;
    if (pool <= 0 || list.length === 0) continue;
    const totalW = list.reduce((s, x) => s + x.amount, 0);
    if (!Number.isFinite(totalW) || totalW <= 0) continue;
    for (const row of list) {
      out.push({
        month,
        developer: row.developer,
        chargedCents: Math.round(pool * (row.amount / totalW)),
      });
    }
  }
  out.sort((a, b) => b.chargedCents - a.chargedCents);
  return out;
}

export type CsvDeveloperEstimateBasis = 'tabular_weight' | 'equal_nova_fallback';

export interface CsvDeveloperEstimateRow {
  developer: string;
  rows: number;
  amount: number;
  estRangeCents: number;
  estUsdPerAmount: number | null;
  basis: CsvDeveloperEstimateBasis;
}

/**
 * Allocate the team **model-estimate** range total across tabular developer rows by `amount` weight.
 * When every weight is zero, splits **evenly** across those rows (still tied to tabular keys, e.g. email).
 */
export function buildCsvDeveloperEstimateRowsFromTabular(
  rows: readonly { developer: string; rows: number; amount: number }[],
  totalCents: number,
): CsvDeveloperEstimateRow[] {
  if (rows.length === 0) return [];
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return rows.map((r) => ({
      ...r,
      estRangeCents: 0,
      estUsdPerAmount: null,
      basis: 'tabular_weight',
    }));
  }
  const wSum = rows.reduce((s, r) => s + (Number.isFinite(r.amount) && r.amount > 0 ? r.amount : 0), 0);
  if (wSum <= 0) {
    const each = Math.round(totalCents / rows.length);
    return rows.map((r) => ({
      ...r,
      estRangeCents: each,
      estUsdPerAmount: r.amount > 0 ? each / 100 / r.amount : null,
      basis: 'tabular_weight',
    }));
  }
  return rows.map((r) => {
    const w = Number.isFinite(r.amount) && r.amount > 0 ? r.amount : 0;
    const estRangeCents = Math.round(totalCents * (w / wSum));
    return {
      ...r,
      estRangeCents,
      estUsdPerAmount: r.amount > 0 ? estRangeCents / 100 / r.amount : null,
      basis: 'tabular_weight',
    };
  });
}

/**
 * Team **Analytics** daily rollup has no per-user column — optional **equal** split of the same model-estimate
 * total across known NOVA display names so the Developers tab still shows a number (clearly labeled, not usage-based).
 */
export function buildCsvDeveloperEstimateRowsNovaEqualSplit(
  displayNames: readonly string[],
  totalCents: number,
): CsvDeveloperEstimateRow[] {
  const n = displayNames.length;
  if (n === 0 || !Number.isFinite(totalCents) || totalCents <= 0) return [];
  const each = Math.round(totalCents / n);
  return displayNames.map((developer) => ({
    developer,
    rows: 0,
    amount: 0,
    estRangeCents: each,
    estUsdPerAmount: null,
    basis: 'equal_nova_fallback',
  }));
}
