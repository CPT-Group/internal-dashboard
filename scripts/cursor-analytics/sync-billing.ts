/**
 * CLI billing sync — spend, daily usage, and per-UTC-day usage-event shards.
 *
 * Usage:
 *   npm run cursor-analytics:sync-billing -- --days 14
 *   npm run cursor-analytics:sync-billing -- --start 2026-05-01 --end 2026-05-14
 *   npm run cursor-analytics:sync-billing -- --skip-events
 *   npm run cursor-analytics:sync-billing -- --force
 *
 * Env: CURSOR_ADMIN_API_KEY (from .env.local)
 */

import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import {
  fetchDailyRangeAggregated,
  fetchSpend,
  fetchUsageEventsForSingleDay,
  isoRangeToMs,
  type UsageEventsFetchPolicy,
} from '../../src/lib/cursorAdminApi';
import {
  appendBillingSyncLog,
  readBillingDayShard,
  readBillingStoreMeta,
  resolveBillingStoreDir,
  writeBillingDayShard,
  writeBillingStoreMeta,
  type BillingDayShard,
  type BillingStoreMeta,
} from '../../src/lib/cursorBillingStore';
import { eachIsoDayInclusive } from '../../src/utils/cursorAnalyticsTeamTrend';

function loadEnv(): void {
  const root = process.cwd();
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      return;
    }
  }
}

function isoDayOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface CliOptions {
  startDate: string;
  endDate: string;
  skipEvents: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  let startDate = '';
  let endDate = '';
  let days = 14;
  let skipEvents = false;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skip-events') {
      skipEvents = true;
      continue;
    }
    if (arg === '--force') {
      force = true;
      continue;
    }
    if (arg === '--days' && argv[i + 1]) {
      const n = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(n) && n > 0) days = n;
      i += 1;
      continue;
    }
    if (arg === '--start' && argv[i + 1]) {
      startDate = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--end' && argv[i + 1]) {
      endDate = argv[i + 1];
      i += 1;
      continue;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    endDate = isoDayOffset(0);
    startDate = isoDayOffset(-(days - 1));
  }

  return { startDate, endDate, skipEvents, force };
}

function usageEventsPolicy(): UsageEventsFetchPolicy {
  const maxPagesPerDay =
    Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY ?? '', 10) || 50_000;
  return {
    requestDelayMs: 0,
    maxPagesPerDay,
  };
}

async function main(): Promise<void> {
  loadEnv();
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    console.error('Missing CURSOR_ADMIN_API_KEY');
    process.exit(1);
  }

  const storeDir = resolveBillingStoreDir();
  const { startMs, endMs } = isoRangeToMs(opts.startDate, opts.endDate);
  const dayKeys = eachIsoDayInclusive(opts.startDate, opts.endDate);

  console.log(`Billing sync ${opts.startDate} → ${opts.endDate} (${String(dayKeys.length)} UTC days)`);
  console.log(`Store: ${storeDir}`);

  const spendResult = await fetchSpend(apiKey);
  if (!spendResult.ok) {
    console.error('Spend failed:', spendResult.message);
    process.exit(1);
  }

  const dailyResult = await fetchDailyRangeAggregated(apiKey, startMs, endMs);
  if (!dailyResult.ok) {
    console.error('Daily usage failed:', dailyResult.message);
    process.exit(1);
  }

  const priorMeta = await readBillingStoreMeta(storeDir);
  const meta: BillingStoreMeta = {
    lastSyncAt: new Date().toISOString(),
    subscriptionCycleStart: spendResult.data.subscriptionCycleStart,
    spend: {
      members: spendResult.data.members,
      subscriptionCycleStart: spendResult.data.subscriptionCycleStart,
    },
    daily: dailyResult.data,
  };
  if (priorMeta?.daily) {
    meta.daily = priorMeta.daily;
    for (const [d, v] of Object.entries(dailyResult.data.usageBasedByDay)) {
      meta.daily.usageBasedByDay[d] = v;
    }
    for (const [d, v] of Object.entries(dailyResult.data.includedByDay)) {
      meta.daily.includedByDay[d] = v;
    }
    for (const [ext, v] of Object.entries(dailyResult.data.extensionActivity)) {
      meta.daily.extensionActivity[ext] = v;
    }
    for (const [email, dev] of Object.entries(dailyResult.data.developerByDay)) {
      meta.daily.developerByDay[email] = dev;
    }
  }

  await writeBillingStoreMeta(meta, storeDir);
  console.log(`Updated meta.json (${String(spendResult.data.members.length)} members)`);

  if (opts.skipEvents) {
    console.log('Skipped usage events (--skip-events)');
    await appendBillingSyncLog({ event: 'sync', skipEvents: true, days: dayKeys.length }, storeDir);
    return;
  }

  const policy = usageEventsPolicy();
  let failedDays = 0;
  let skippedDays = 0;
  let syncedDays = 0;

  for (const day of dayKeys) {
    if (!opts.force) {
      const existing = await readBillingDayShard(day, storeDir);
      if (existing?.complete === true) {
        skippedDays += 1;
        continue;
      }
    }

    process.stdout.write(`  ${day} … `);
    const result = await fetchUsageEventsForSingleDay(apiKey, day, policy);
    if (!result.ok) {
      console.log(`FAILED (${result.message})`);
      failedDays += 1;
      const partial: BillingDayShard = {
        day,
        fetchedAt: new Date().toISOString(),
        complete: false,
        totalChargedCents: 0,
        rowsReturned: 0,
        warnings: [result.message],
        byDeveloper: {},
        byRepo: {},
        byRepoDeveloper: {},
        byMonthDeveloper: {},
      };
      await writeBillingDayShard(partial, storeDir);
      continue;
    }

    const d = result.data;
    const shard: BillingDayShard = {
      day,
      fetchedAt: new Date().toISOString(),
      complete: d.complete,
      totalChargedCents: d.aggregates.byDay[day] ?? 0,
      rowsReturned: d.rowsReturned,
      totalReported: d.totalReported,
      warnings: d.warnings,
      byDeveloper: d.aggregates.byDeveloper,
      byRepo: d.aggregates.byRepo,
      byRepoDeveloper: d.aggregates.byRepoDeveloper,
      byMonthDeveloper: d.aggregates.byMonthDeveloper,
    };
    await writeBillingDayShard(shard, storeDir);
    syncedDays += 1;
    const usd = (shard.totalChargedCents / 100).toFixed(2);
    console.log(`${d.complete ? 'complete' : 'partial'} $${usd} (${String(d.rowsReturned)} rows)`);
    if (!d.complete) failedDays += 1;
  }

  meta.lastSyncAt = new Date().toISOString();
  await writeBillingStoreMeta(meta, storeDir);
  await appendBillingSyncLog(
    {
      event: 'sync',
      startDate: opts.startDate,
      endDate: opts.endDate,
      syncedDays,
      skippedDays,
      failedDays,
    },
    storeDir,
  );

  console.log(`Done: synced ${String(syncedDays)}, skipped ${String(skippedDays)}, failed/partial ${String(failedDays)}`);
  if (failedDays > 0) {
    process.exit(2);
  }
}

void main();
