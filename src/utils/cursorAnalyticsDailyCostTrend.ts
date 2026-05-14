import type { CursorAnalyticsSummary } from '@/types/cursorAnalytics';

import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';

export type CursorDailyCostTrendSource =
  | 'usage_events'
  | 'usage_events_csv_backfill'
  | 'csv_scaled_only';

export interface TeamDailyUsdTrendHybridResult {
  usdByDay: Record<string, number>;
  source: CursorDailyCostTrendSource;
}

function csvAmountForDay(summary: CursorAnalyticsSummary, day: string): number {
  const b = summary.byDay[day];
  const n = b?.amount;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Daily team USD: **usage-event charged cents** per day where present; days with no
 * event cents but CSV daily activity use **scaled** CSV amounts (`k` from overlap
 * or whole-range ratio), unless `disableCsvDollarBackfill` is true (incomplete events).
 */
export function teamDailyUsdTrendHybrid(options: {
  range: { startDate: string; endDate: string };
  chargedByDayCents: Record<string, number>;
  summary: CursorAnalyticsSummary;
  /** When true, do not scale CSV request counts into dollars (avoids misleading $ when events were truncated). */
  disableCsvDollarBackfill?: boolean;
}): TeamDailyUsdTrendHybridResult {
  const { range, chargedByDayCents, summary, disableCsvDollarBackfill } = options;
  const days = eachIsoDayInclusive(range.startDate, range.endDate);

  let sumOverlapCharged = 0;
  let sumOverlapCsv = 0;
  let sumRangeCharged = 0;
  let sumRangeCsv = 0;

  for (const d of days) {
    const ch = chargedByDayCents[d] ?? 0;
    const csv = csvAmountForDay(summary, d);
    if (ch > 0) sumRangeCharged += ch;
    if (csv > 0) sumRangeCsv += csv;
    if (ch > 0 && csv > 0) {
      sumOverlapCharged += ch;
      sumOverlapCsv += csv;
    }
  }

  let k = 0;
  if (sumOverlapCsv > 0 && sumOverlapCharged > 0) {
    k = sumOverlapCharged / sumOverlapCsv;
  } else if (sumRangeCsv > 0 && sumRangeCharged > 0) {
    k = sumRangeCharged / sumRangeCsv;
  }

  const usdByDay: Record<string, number> = {};
  let usedBackfill = false;
  let usedEvents = false;

  for (const d of days) {
    const ch = chargedByDayCents[d] ?? 0;
    const csv = csvAmountForDay(summary, d);
    if (ch > 0) {
      usdByDay[d] = ch / 100;
      usedEvents = true;
      continue;
    }
    if (!disableCsvDollarBackfill && csv > 0 && k > 0) {
      usdByDay[d] = (k * csv) / 100;
      usedBackfill = true;
      continue;
    }
    usdByDay[d] = 0;
  }

  let source: CursorDailyCostTrendSource;
  if (usedEvents && usedBackfill) {
    source = 'usage_events_csv_backfill';
  } else if (usedEvents) {
    source = 'usage_events';
  } else if (usedBackfill) {
    source = 'csv_scaled_only';
  } else {
    source = 'usage_events';
  }

  return { usdByDay, source };
}
