/**
 * Builds a daily **USD** series that matches **team cycle invoice totals** from
 * `/teams/spend` (sum of `overallSpendCents`), shaped by team request volume from
 * `/teams/daily-usage-data` so peaks align with heavy-usage days.
 *
 * Only days with `day >= subscriptionCycleStart` (UTC date) receive a non-zero share;
 * earlier days in the selected range stay at 0. Sum of returned USD × 100 over all
 * days in the range equals `totalCycleCents` when at least one in-range day has weight.
 */

import type { CursorAdminResult } from '@/lib/cursorAdminApi';

export function eachIsoDayInclusive(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${startIso}T00:00:00.000Z`);
  const end = Date.parse(`${endIso}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return out;
  for (let t = start; t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function isoDayUtcFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function teamCostUsdByDayFromSpendShape(options: {
  range: { startDate: string; endDate: string };
  spend: CursorAdminResult<{
    members: { overallSpendCents: number }[];
    subscriptionCycleStart?: number;
  }>;
  daily: CursorAdminResult<{
    usageBasedByDay: Record<string, number>;
    includedByDay: Record<string, number>;
  }>;
}): Record<string, number> | null {
  const { range, spend, daily } = options;
  if (!spend.ok || !daily.ok) return null;
  const totalCycleCents = spend.data.members.reduce((sum, m) => sum + m.overallSpendCents, 0);
  if (!Number.isFinite(totalCycleCents) || totalCycleCents <= 0) return null;

  const cycleStartMs = spend.data.subscriptionCycleStart;
  const cycleStartDay =
    typeof cycleStartMs === 'number' && Number.isFinite(cycleStartMs)
      ? isoDayUtcFromMs(cycleStartMs)
      : range.startDate;

  const usageByDay = daily.data.usageBasedByDay;
  const incByDay = daily.data.includedByDay;
  const days = eachIsoDayInclusive(range.startDate, range.endDate);
  let sumWeights = 0;
  const weights: Record<string, number> = {};
  for (const d of days) {
    if (d < cycleStartDay) {
      weights[d] = 0;
      continue;
    }
    const w = (usageByDay[d] ?? 0) + (incByDay[d] ?? 0);
    weights[d] = w;
    sumWeights += w;
  }

  const out: Record<string, number> = {};
  if (sumWeights <= 0) {
    const eligible = days.filter((d) => d >= cycleStartDay);
    if (eligible.length === 0) return null;
    const perDayUsd = totalCycleCents / eligible.length / 100;
    for (const d of days) {
      out[d] = d >= cycleStartDay ? perDayUsd : 0;
    }
    return out;
  }

  for (const d of days) {
    const w = weights[d] ?? 0;
    const cents = (w / sumWeights) * totalCycleCents;
    out[d] = cents / 100;
  }
  return out;
}
