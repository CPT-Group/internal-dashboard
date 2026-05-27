/**
 * On-disk billing store — per-UTC-day usage-event shards + meta (spend + daily).
 * Populated by `npm run cursor-analytics:sync-billing`; read by GET /api/cursor-analytics.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { ChargedEventAggregates, CursorAdminResult, CursorBillingSnapshot, CursorTeamMemberSpend } from '@/lib/cursorAdminApi';
import { createEmptyChargedAggregates } from '@/lib/cursorAdminApi';
import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';

export interface BillingDayShard {
  day: string;
  fetchedAt: string;
  complete: boolean;
  totalChargedCents: number;
  rowsReturned: number;
  totalReported?: number;
  warnings: string[];
  byDeveloper: Record<string, number>;
  byRepo: Record<string, number>;
  byRepoDeveloper: Record<string, number>;
  byMonthDeveloper: Record<string, number>;
}

export interface BillingStoreMeta {
  lastSyncAt: string;
  subscriptionCycleStart?: number;
  spend?: {
    members: CursorTeamMemberSpend[];
    subscriptionCycleStart?: number;
  };
  daily?: {
    usageBasedByDay: Record<string, number>;
    includedByDay: Record<string, number>;
    extensionActivity: Record<string, number>;
    developerByDay: Record<
      string,
      {
        usageBasedByDay: Record<string, number>;
        includedByDay: Record<string, number>;
      }
    >;
  };
}

export interface CursorBillingStoreCoverage {
  daysTotal: number;
  daysComplete: number;
  daysMissing: string[];
  daysIncomplete: string[];
  truncated: boolean;
}

export interface CursorBillingStoreStatus {
  lastSyncAt: string | null;
  coverage: CursorBillingStoreCoverage;
  storePath: string;
}

export function resolveBillingStoreDir(): string {
  const raw = process.env.CURSOR_ANALYTICS_BILLING_STORE_DIR?.trim();
  if (raw && raw.length > 0) {
    return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  }
  return path.join(process.cwd(), 'kyleOutput', 'cursor-billing-store');
}

function metaPath(storeDir: string): string {
  return path.join(storeDir, 'meta.json');
}

function dayShardPath(storeDir: string, day: string): string {
  return path.join(storeDir, 'days', `${day}.json`);
}

export async function readBillingStoreMeta(storeDir?: string): Promise<BillingStoreMeta | null> {
  const dir = storeDir ?? resolveBillingStoreDir();
  try {
    const text = await fs.readFile(metaPath(dir), 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as BillingStoreMeta;
    if (typeof o.lastSyncAt !== 'string') return null;
    return o;
  } catch {
    return null;
  }
}

export async function writeBillingStoreMeta(meta: BillingStoreMeta, storeDir?: string): Promise<void> {
  const dir = storeDir ?? resolveBillingStoreDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(metaPath(dir), JSON.stringify(meta, null, 2), 'utf8');
}

export async function readBillingDayShard(day: string, storeDir?: string): Promise<BillingDayShard | null> {
  const dir = storeDir ?? resolveBillingStoreDir();
  try {
    const text = await fs.readFile(dayShardPath(dir, day), 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as BillingDayShard;
    if (typeof o.day !== 'string' || typeof o.complete !== 'boolean') return null;
    return o;
  } catch {
    return null;
  }
}

export async function writeBillingDayShard(shard: BillingDayShard, storeDir?: string): Promise<void> {
  const dir = storeDir ?? resolveBillingStoreDir();
  const daysDir = path.join(dir, 'days');
  await fs.mkdir(daysDir, { recursive: true });
  await fs.writeFile(dayShardPath(dir, shard.day), JSON.stringify(shard, null, 2), 'utf8');
}

export async function appendBillingSyncLog(line: Record<string, string | number | boolean>, storeDir?: string): Promise<void> {
  const dir = storeDir ?? resolveBillingStoreDir();
  await fs.mkdir(dir, { recursive: true });
  const entry = JSON.stringify({ at: new Date().toISOString(), ...line });
  await fs.appendFile(path.join(dir, 'sync-log.jsonl'), `${entry}\n`, 'utf8');
}

function mergeShardIntoAggregates(shard: BillingDayShard, into: ChargedEventAggregates, byDay: Record<string, number>): void {
  byDay[shard.day] = (byDay[shard.day] ?? 0) + shard.totalChargedCents;
  const month = shard.day.slice(0, 7);
  into.byMonth[month] = (into.byMonth[month] ?? 0) + shard.totalChargedCents;

  for (const [k, v] of Object.entries(shard.byDeveloper)) {
    into.byDeveloper[k] = (into.byDeveloper[k] ?? 0) + v;
    into.byMonthDeveloper[`${month}\t${k}`] = (into.byMonthDeveloper[`${month}\t${k}`] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(shard.byRepo)) {
    into.byRepo[k] = (into.byRepo[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(shard.byRepoDeveloper)) {
    into.byRepoDeveloper[k] = (into.byRepoDeveloper[k] ?? 0) + v;
  }
}

export function buildBillingStoreStatus(
  startDate: string,
  endDate: string,
  shards: Map<string, BillingDayShard | null>,
  storeDir: string,
  lastSyncAt: string | null,
): CursorBillingStoreStatus {
  const dayKeys = eachIsoDayInclusive(startDate, endDate);
  const daysMissing: string[] = [];
  const daysIncomplete: string[] = [];
  let daysComplete = 0;

  for (const day of dayKeys) {
    const shard = shards.get(day) ?? null;
    if (!shard) {
      daysMissing.push(day);
      continue;
    }
    if (shard.complete) {
      daysComplete += 1;
    } else {
      daysIncomplete.push(day);
    }
  }

  return {
    lastSyncAt,
    storePath: storeDir,
    coverage: {
      daysTotal: dayKeys.length,
      daysComplete,
      daysMissing,
      daysIncomplete,
      truncated: daysMissing.length > 0 || daysIncomplete.length > 0,
    },
  };
}

export async function getBillingStoreStatus(
  startDate: string,
  endDate: string,
  storeDir?: string,
): Promise<CursorBillingStoreStatus> {
  const dir = storeDir ?? resolveBillingStoreDir();
  const meta = await readBillingStoreMeta(dir);
  const dayKeys = eachIsoDayInclusive(startDate, endDate);
  const shards = new Map<string, BillingDayShard | null>();
  for (const day of dayKeys) {
    shards.set(day, await readBillingDayShard(day, dir));
  }
  return buildBillingStoreStatus(startDate, endDate, shards, dir, meta?.lastSyncAt ?? null);
}

export interface LoadBillingForRangeResult {
  ok: boolean;
  message?: string;
  status: CursorBillingStoreStatus;
  chargedByDay: CursorAdminResult<{
    byDay: Record<string, number>;
    byMonth: Record<string, number>;
    byDeveloper: Record<string, number>;
    byRepo: Record<string, number>;
    byRepoDeveloper: Record<string, number>;
    byMonthDeveloper: Record<string, number>;
    eventsRead: number;
    truncated: boolean;
    usageEventRowsReturned?: number;
    usageEventsTotalReported?: number;
    warnings?: string[];
  }>;
}

export async function loadBillingForRange(startDate: string, endDate: string, storeDir?: string): Promise<LoadBillingForRangeResult> {
  const dir = storeDir ?? resolveBillingStoreDir();
  const meta = await readBillingStoreMeta(dir);
  const dayKeys = eachIsoDayInclusive(startDate, endDate);
  const shards = new Map<string, BillingDayShard | null>();

  const aggregates = createEmptyChargedAggregates();
  const byDay: Record<string, number> = {};
  let eventsRead = 0;
  let usageEventRowsReturned = 0;
  let usageEventsTotalReported = 0;
  let reportedChunks = 0;
  const warnings: string[] = [];

  for (const day of dayKeys) {
    const shard = await readBillingDayShard(day, dir);
    shards.set(day, shard);
    if (!shard) continue;

    mergeShardIntoAggregates(shard, aggregates, byDay);
    eventsRead += shard.rowsReturned;
    usageEventRowsReturned += shard.rowsReturned;
    if (typeof shard.totalReported === 'number') {
      usageEventsTotalReported += shard.totalReported;
      reportedChunks += 1;
    }
    if (shard.warnings.length > 0) {
      warnings.push(...shard.warnings);
    }
  }

  const status = buildBillingStoreStatus(startDate, endDate, shards, dir, meta?.lastSyncAt ?? null);
  const { coverage } = status;

  if (coverage.daysComplete === 0 && coverage.daysMissing.length === coverage.daysTotal) {
    return {
      ok: false,
      message: 'Billing store empty for this range. Run: npm run cursor-analytics:sync-billing -- --days 14',
      status,
      chargedByDay: {
        ok: false,
        status: 0,
        message: 'Billing store not synced for this date range',
      },
    };
  }

  const truncated = coverage.truncated;
  if (coverage.daysMissing.length > 0) {
    warnings.push(
      `Billing store missing ${String(coverage.daysMissing.length)} day(s): ${coverage.daysMissing.slice(0, 5).join(', ')}${coverage.daysMissing.length > 5 ? '…' : ''}. Run npm run cursor-analytics:sync-billing.`,
    );
  }
  if (coverage.daysIncomplete.length > 0) {
    warnings.push(
      `Billing store incomplete for ${String(coverage.daysIncomplete.length)} day(s): ${coverage.daysIncomplete.slice(0, 5).join(', ')}${coverage.daysIncomplete.length > 5 ? '…' : ''}. Re-run sync with --force.`,
    );
  }
  if (reportedChunks > 0 && usageEventsTotalReported > 0 && usageEventRowsReturned < usageEventsTotalReported) {
    warnings.push(
      `Billing store: ${String(usageEventRowsReturned)} event rows vs reported ${String(usageEventsTotalReported)} — incomplete pagination.`,
    );
  }

  return {
    ok: coverage.daysComplete === coverage.daysTotal,
    message: truncated ? 'Billing store coverage incomplete for full range charged totals' : undefined,
    status,
    chargedByDay: {
      ok: true,
      data: {
        byDay,
        byMonth: aggregates.byMonth,
        byDeveloper: aggregates.byDeveloper,
        byRepo: aggregates.byRepo,
        byRepoDeveloper: aggregates.byRepoDeveloper,
        byMonthDeveloper: aggregates.byMonthDeveloper,
        eventsRead,
        truncated,
        usageEventRowsReturned: usageEventRowsReturned > 0 ? usageEventRowsReturned : undefined,
        usageEventsTotalReported: reportedChunks > 0 ? usageEventsTotalReported : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    },
  };
}

/** Merge store meta spend/daily into a quick billing snapshot when available. */
export function enrichBillingFromStoreMeta(
  billing: CursorBillingSnapshot,
  meta: BillingStoreMeta | null,
): CursorBillingSnapshot {
  if (!meta) return billing;
  const next = { ...billing };
  if (meta.spend && meta.spend.members.length > 0 && !billing.spend.ok) {
    next.spend = {
      ok: true,
      data: {
        members: meta.spend.members,
        subscriptionCycleStart: meta.subscriptionCycleStart ?? meta.spend.subscriptionCycleStart,
      },
    };
  }
  if (meta.daily && !billing.dailyByDay.ok) {
    next.dailyByDay = { ok: true, data: meta.daily };
  }
  return next;
}
