import type { CursorTeamMemberSpend } from '@/lib/cursorAdminApi';

import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';

export interface DeveloperMoneyRangeRow {
  email: string;
  name: string;
  role: string;
  cycleSpendCents: number;
  cycleOverallCents: number;
  chargedRangeCents: number;
  usageReqsInRange: number;
  includedReqsInRange: number;
}

function sumUsageForDeveloperInRange(
  perDev: {
    usageBasedByDay: Record<string, number>;
    includedByDay: Record<string, number>;
  },
  range: { startDate: string; endDate: string },
): { usage: number; included: number } {
  let usage = 0;
  let included = 0;
  for (const d of eachIsoDayInclusive(range.startDate, range.endDate)) {
    usage += perDev.usageBasedByDay[d] ?? 0;
    included += perDev.includedByDay[d] ?? 0;
  }
  return { usage, included };
}

/**
 * One row per team member from `/teams/spend`, plus **charged (usage events)** and
 * **usage/included request counts** summed only over the **selected ISO date range**
 * (from `/teams/daily-usage-data` rows that fall in range).
 *
 * Also appends rows for emails that appear in **charged** but not in **spend** (e.g. former member).
 */
export function buildDeveloperMoneyRangeRows(options: {
  spendMembers: CursorTeamMemberSpend[];
  chargedByDeveloper: Record<string, number>;
  developerByDay:
    | Record<
        string,
        {
          usageBasedByDay: Record<string, number>;
          includedByDay: Record<string, number>;
        }
      >
    | undefined;
  range: { startDate: string; endDate: string };
}): DeveloperMoneyRangeRow[] {
  const { spendMembers, chargedByDeveloper, developerByDay, range } = options;
  const byEmail = new Map<string, DeveloperMoneyRangeRow>();

  for (const m of spendMembers) {
    const key = m.email.trim().toLowerCase();
    const perDev = developerByDay?.[key];
    const sums = perDev ? sumUsageForDeveloperInRange(perDev, range) : { usage: 0, included: 0 };
    byEmail.set(key, {
      email: m.email,
      name: m.name,
      role: m.role,
      cycleSpendCents: m.spendCents,
      cycleOverallCents: m.overallSpendCents,
      chargedRangeCents: chargedByDeveloper[key] ?? 0,
      usageReqsInRange: sums.usage,
      includedReqsInRange: sums.included,
    });
  }

  for (const [emailKey, chargedCents] of Object.entries(chargedByDeveloper)) {
    const key = emailKey.trim().toLowerCase();
    if (byEmail.has(key)) continue;
    const perDev = developerByDay?.[key];
    const sums = perDev ? sumUsageForDeveloperInRange(perDev, range) : { usage: 0, included: 0 };
    byEmail.set(key, {
      email: emailKey,
      name: '—',
      role: '—',
      cycleSpendCents: 0,
      cycleOverallCents: 0,
      chargedRangeCents: chargedCents,
      usageReqsInRange: sums.usage,
      includedReqsInRange: sums.included,
    });
  }

  return [...byEmail.values()].sort((a, b) => b.chargedRangeCents - a.chargedRangeCents);
}
