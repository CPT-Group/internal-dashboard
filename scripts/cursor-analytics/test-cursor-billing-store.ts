/**
 * Unit tests for billing store merge logic (fixture shards, no network).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  loadBillingForRange,
  writeBillingDayShard,
  writeBillingStoreMeta,
  type BillingDayShard,
} from '../../src/lib/cursorBillingStore';

async function withTempStore(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cursor-billing-store-'));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function shard(day: string, cents: number, complete = true): BillingDayShard {
  return {
    day,
    fetchedAt: new Date().toISOString(),
    complete,
    totalChargedCents: cents,
    rowsReturned: 10,
    totalReported: 10,
    warnings: [],
    byDeveloper: { 'dev@example.com': cents },
    byRepo: { 'org/repo': cents },
    byRepoDeveloper: { 'org/repo\tdev@example.com': cents },
    byMonthDeveloper: {},
  };
}

async function main(): Promise<void> {
  await withTempStore(async (dir) => {
    await writeBillingStoreMeta({ lastSyncAt: new Date().toISOString() }, dir);
    await writeBillingDayShard(shard('2026-05-01', 100), dir);
    await writeBillingDayShard(shard('2026-05-02', 200), dir);

    const result = await loadBillingForRange('2026-05-01', '2026-05-02', dir);
    assert.equal(result.ok, true);
    assert.equal(result.chargedByDay.ok, true);
    if (!result.chargedByDay.ok) throw new Error('expected ok chargedByDay');
    assert.equal(result.chargedByDay.data.byDay['2026-05-01'], 100);
    assert.equal(result.chargedByDay.data.byDay['2026-05-02'], 200);
    assert.equal(result.status.coverage.daysComplete, 2);
    assert.equal(result.status.coverage.daysTotal, 2);
  });

  await withTempStore(async (dir) => {
    await writeBillingStoreMeta({ lastSyncAt: new Date().toISOString() }, dir);
    await writeBillingDayShard(shard('2026-05-01', 100, false), dir);

    const result = await loadBillingForRange('2026-05-01', '2026-05-02', dir);
    assert.equal(result.ok, false);
    assert.equal(result.status.coverage.daysComplete, 0);
    assert.equal(result.status.coverage.daysMissing.length, 1);
    assert.equal(result.status.coverage.daysIncomplete.length, 1);
    if (!result.chargedByDay.ok) throw new Error('expected partial merge');
    assert.equal(result.chargedByDay.data.truncated, true);
  });

  await withTempStore(async (dir) => {
    const result = await loadBillingForRange('2026-05-01', '2026-05-01', dir);
    assert.equal(result.ok, false);
    assert.equal(result.chargedByDay.ok, false);
    assert.match(result.message ?? '', /sync-billing/);
  });

  console.log('test:cursor-billing-store — all assertions passed');
}

void main();
