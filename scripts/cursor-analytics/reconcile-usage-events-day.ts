/**
 * One-day reconciliation: live pull vs billing store shard for a UTC calendar day.
 *
 * Usage: npm run cursor-analytics:reconcile-day -- 2026-05-13
 * Env: CURSOR_ADMIN_API_KEY (from .env.local)
 */

import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

import { fetchUsageEventsForSingleDay, type UsageEventsFetchPolicy } from '../../src/lib/cursorAdminApi';
import { readBillingDayShard, resolveBillingStoreDir } from '../../src/lib/cursorBillingStore';

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

function usageEventsPolicy(): UsageEventsFetchPolicy {
  const maxPagesPerDay =
    Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY ?? '', 10) || 50_000;
  return { requestDelayMs: 0, maxPagesPerDay };
}

async function main(): Promise<void> {
  loadEnv();
  const day = process.argv[2]?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error('Usage: npm run cursor-analytics:reconcile-day -- YYYY-MM-DD');
    process.exit(1);
  }
  const apiKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    console.error('Missing CURSOR_ADMIN_API_KEY');
    process.exit(1);
  }

  const storeDir = resolveBillingStoreDir();
  const shard = await readBillingDayShard(day, storeDir);
  const live = await fetchUsageEventsForSingleDay(apiKey, day, usageEventsPolicy());
  if (!live.ok) {
    console.error('Live pull failed:', live.message);
    process.exit(1);
  }

  const liveCents = live.data.aggregates.byDay[day] ?? 0;
  const storeCents = shard?.totalChargedCents ?? null;

  console.log(`UTC day ${day}`);
  console.log(`Store path: ${storeDir}`);
  console.log(`Live charged cents: ${liveCents.toFixed(4)} (= $${(liveCents / 100).toFixed(2)})`);
  console.log(`Live rows: ${String(live.data.rowsReturned)} complete=${String(live.data.complete)}`);
  if (shard) {
    console.log(`Store charged cents: ${shard.totalChargedCents.toFixed(4)} complete=${String(shard.complete)}`);
    console.log(`Store rows: ${String(shard.rowsReturned)} fetchedAt=${shard.fetchedAt}`);
    const delta = Math.abs(liveCents - shard.totalChargedCents);
    if (delta > 0.01) {
      console.error(`Mismatch: live vs store delta ${delta.toFixed(4)} cents`);
      process.exit(2);
    }
    console.log('Store shard matches live pull.');
  } else {
    console.warn('No store shard for this day — run npm run cursor-analytics:sync-billing');
    process.exit(2);
  }
}

void main();
