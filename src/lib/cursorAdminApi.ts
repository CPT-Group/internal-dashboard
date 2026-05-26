/**
 * Cursor **Admin** REST API (team owner key) — billing & usage.
 * See https://cursor.com/docs/account/teams/admin-api
 *
 * Not the same as **Enterprise Analytics** (`/analytics/team/*`), which returns 401 unless the org is on Enterprise.
 */

import { cursorAdminPost } from '@/lib/cursorAdminHttp';
import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';
import { extractUsageEventRepoFromRow } from '@/utils/cursorUsageEventRepo';

async function adminPostRaw(
  apiKey: string,
  path: string,
  body: object,
): Promise<{ status: number; text: string }> {
  const result = await cursorAdminPost({ apiKey, path, body });
  return { status: result.status, text: result.text };
}

export type CursorAdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export interface CursorTeamMemberSpend {
  userId: string;
  name: string;
  email: string;
  role: string;
  spendCents: number;
  overallSpendCents: number;
  fastPremiumRequests: number;
}

export interface CursorDailyUsageRow {
  day: string;
  email: string;
  usageBasedReqs: number;
  subscriptionIncludedReqs: number;
  applyMostUsedExtension: string | null;
}

export interface CursorBillingSnapshot {
  spend: CursorAdminResult<{ members: CursorTeamMemberSpend[]; subscriptionCycleStart?: number }>;
  dailyByDay: CursorAdminResult<{
    /** ISO date → summed team usage-based requests */
    usageBasedByDay: Record<string, number>;
    /** ISO date → summed subscription-included requests */
    includedByDay: Record<string, number>;
    /** applyMostUsedExtension → summed usage-based + included (activity proxy, not $) */
    extensionActivity: Record<string, number>;
    /** email -> per-day usage/included request counts */
    developerByDay: Record<
      string,
      {
        usageBasedByDay: Record<string, number>;
        includedByDay: Record<string, number>;
      }
    >;
  }>;
  /** Sum `chargedCents` from `/teams/filtered-usage-events` (UTC-day chunks, paginated per chunk; may be truncated). */
  chargedByDay: CursorAdminResult<{
    byDay: Record<string, number>;
    byMonth: Record<string, number>;
    byDeveloper: Record<string, number>;
    byRepo: Record<string, number>;
    byRepoDeveloper: Record<string, number>;
    byMonthDeveloper: Record<string, number>;
    eventsRead: number;
    truncated: boolean;
    /** Raw `usageEvents` array length summed across all HTTP pages (reconciliation vs reported totals). */
    usageEventRowsReturned?: number;
    usageEventsTotalReported?: number;
    warnings?: string[];
  }>;
}

/** Disk cache policy for usage events (v2 = chunked full pagination + throttle). */
export interface CursorUsageEventsCachePolicy {
  v: 2;
  requestDelayMs: number;
  maxPagesPerDay: number;
}

interface CacheEnvelope {
  fetchedAt: string;
  startMs: number;
  endMs: number;
  usageEventsPolicy: CursorUsageEventsCachePolicy | null;
  snapshot: CursorBillingSnapshot;
}

/** Charged-event aggregate buckets (shared by live fetch + billing store). */
export interface ChargedEventAggregates {
  byDay: Record<string, number>;
  byMonth: Record<string, number>;
  byDeveloper: Record<string, number>;
  byRepo: Record<string, number>;
  byRepoDeveloper: Record<string, number>;
  byMonthDeveloper: Record<string, number>;
}

export function createEmptyChargedAggregates(): ChargedEventAggregates {
  return {
    byDay: {},
    byMonth: {},
    byDeveloper: {},
    byRepo: {},
    byRepoDeveloper: {},
    byMonthDeveloper: {},
  };
}

/** Some Admin responses nest payload under `data`. */
function unwrapTeamSpendPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.teamMemberSpend)) return d;
  }
  return o;
}

function parseSpend(raw: unknown): CursorAdminResult<{
  members: CursorTeamMemberSpend[];
  subscriptionCycleStart?: number;
}> {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, status: 0, message: 'Empty spend response' };
  }
  const o = unwrapTeamSpendPayload(raw);
  const arr = o.teamMemberSpend;
  if (!Array.isArray(arr)) {
    return { ok: false, status: 0, message: 'Missing teamMemberSpend array' };
  }
  const members: CursorTeamMemberSpend[] = [];
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (
      typeof r.userId === 'string' &&
      typeof r.name === 'string' &&
      typeof r.email === 'string' &&
      typeof r.role === 'string' &&
      typeof r.spendCents === 'number'
    ) {
      const includedSpendCents = typeof r.includedSpendCents === 'number' ? r.includedSpendCents : 0;
      const overallSpendCents =
        typeof r.overallSpendCents === 'number' ? r.overallSpendCents : r.spendCents + includedSpendCents;
      const fastPremiumRequests = typeof r.fastPremiumRequests === 'number' ? r.fastPremiumRequests : 0;
      members.push({
        userId: r.userId,
        name: r.name,
        email: r.email,
        role: r.role,
        spendCents: r.spendCents,
        overallSpendCents,
        fastPremiumRequests,
      });
    }
  }
  const subscriptionCycleStart =
    typeof o.subscriptionCycleStart === 'number'
      ? o.subscriptionCycleStart
      : typeof (raw as Record<string, unknown>).subscriptionCycleStart === 'number'
        ? ((raw as Record<string, unknown>).subscriptionCycleStart as number)
        : undefined;
  return { ok: true, data: { members, subscriptionCycleStart } };
}

async function fetchSpend(apiKey: string): Promise<CursorAdminResult<{ members: CursorTeamMemberSpend[]; subscriptionCycleStart?: number }>> {
  const { status, text } = await adminPostRaw(apiKey, '/teams/spend', {
    page: 1,
    pageSize: 500,
  });
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, status, message: text.slice(0, 240) };
  }
  if (!status.toString().startsWith('2')) {
    const msg =
      typeof raw === 'object' && raw !== null && 'message' in raw
        ? String((raw as { message: string }).message)
        : text.slice(0, 240);
    return { ok: false, status, message: msg || `HTTP ${status}` };
  }
  return parseSpend(raw);
}

function mergeDailyRows(
  intoUsage: Record<string, number>,
  intoInc: Record<string, number>,
  intoExt: Record<string, number>,
  intoDeveloperByDay: Record<
    string,
    {
      usageBasedByDay: Record<string, number>;
      includedByDay: Record<string, number>;
    }
  >,
  rows: CursorDailyUsageRow[],
): void {
  for (const row of rows) {
    const d = row.day;
    if (!d) continue;
    intoUsage[d] = (intoUsage[d] ?? 0) + row.usageBasedReqs;
    intoInc[d] = (intoInc[d] ?? 0) + row.subscriptionIncludedReqs;
    const ext = row.applyMostUsedExtension?.trim() || '(none)';
    const w = row.usageBasedReqs + row.subscriptionIncludedReqs;
    intoExt[ext] = (intoExt[ext] ?? 0) + w;
    const email = row.email.trim().toLowerCase();
    if (email !== '') {
      if (!intoDeveloperByDay[email]) {
        intoDeveloperByDay[email] = { usageBasedByDay: {}, includedByDay: {} };
      }
      const dev = intoDeveloperByDay[email];
      dev.usageBasedByDay[d] = (dev.usageBasedByDay[d] ?? 0) + row.usageBasedReqs;
      dev.includedByDay[d] = (dev.includedByDay[d] ?? 0) + row.subscriptionIncludedReqs;
    }
  }
}

function parseDailyRow(row: unknown): CursorDailyUsageRow | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.day !== 'string' || typeof r.email !== 'string') return null;
  return {
    day: r.day,
    email: r.email,
    usageBasedReqs: typeof r.usageBasedReqs === 'number' ? r.usageBasedReqs : 0,
    subscriptionIncludedReqs:
      typeof r.subscriptionIncludedReqs === 'number' ? r.subscriptionIncludedReqs : 0,
    applyMostUsedExtension: typeof r.applyMostUsedExtension === 'string' ? r.applyMostUsedExtension : null,
  };
}

/** Merge-only variant returning aggregates */
export async function fetchDailyRangeAggregated(
  apiKey: string,
  startMs: number,
  endMs: number,
): Promise<
  CursorAdminResult<{
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
  }>
> {
  const usageByDay: Record<string, number> = {};
  const incByDay: Record<string, number> = {};
  const extAct: Record<string, number> = {};
  const developerByDay: Record<
    string,
    {
      usageBasedByDay: Record<string, number>;
      includedByDay: Record<string, number>;
    }
  > = {};
  const chunkMs = 29 * 24 * 60 * 60 * 1000;
  for (let s = startMs; s <= endMs; s = Math.min(s + chunkMs, endMs) + 1) {
    const e = Math.min(s + chunkMs, endMs);
    let page = 1;
    for (let guard = 0; guard < 50; guard++) {
      const { status, text } = await adminPostRaw(apiKey, '/teams/daily-usage-data', {
        startDate: s,
        endDate: e,
        page,
        pageSize: 1000,
      });
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        return { ok: false, status, message: text.slice(0, 240) };
      }
      if (!status.toString().startsWith('2')) {
        const msg =
          typeof raw === 'object' && raw !== null && 'message' in raw
            ? String((raw as { message: string }).message)
            : text.slice(0, 240);
        return { ok: false, status, message: msg || `HTTP ${status}` };
      }
      if (!raw || typeof raw !== 'object') return { ok: false, status, message: 'Invalid JSON' };
      const o = raw as { data?: unknown; pagination?: { hasNextPage?: boolean; totalPages?: number } };
      const arr = Array.isArray(o.data) ? o.data : [];
      const rows: CursorDailyUsageRow[] = [];
      for (const row of arr) {
        const p = parseDailyRow(row);
        if (p) rows.push(p);
      }
      mergeDailyRows(usageByDay, incByDay, extAct, developerByDay, rows);
      const pag = o.pagination;
      if (pag?.hasNextPage === true && typeof pag.totalPages === 'number' && page < pag.totalPages) {
        page += 1;
      } else {
        break;
      }
    }
    if (s + chunkMs >= endMs) break;
  }
  return {
    ok: true,
    data: {
      usageBasedByDay: usageByDay,
      includedByDay: incByDay,
      extensionActivity: extAct,
      developerByDay,
    },
  };
}

export interface UsageEventsFetchPolicy {
  /** Delay between each `/teams/filtered-usage-events` HTTP call (20 req/min team limit). */
  requestDelayMs: number;
  /** Safety cap: max pagination pages per UTC calendar day chunk. */
  maxPagesPerDay: number;
}

export function mergeChargedEventRow(
  row: Record<string, unknown>,
  into: ChargedEventAggregates,
): boolean {
  const ts = row.timestamp;
  const chRaw = row.chargedCents;
  if (typeof ts !== 'string' && typeof ts !== 'number') return false;
  const ch =
    typeof chRaw === 'number'
      ? chRaw
      : typeof chRaw === 'string'
        ? Number.parseFloat(chRaw)
        : Number.NaN;
  if (!Number.isFinite(ch)) return false;
  const tmsRaw = typeof ts === 'string' ? Number.parseInt(ts, 10) : ts;
  if (!Number.isFinite(tmsRaw)) return false;
  const tms = tmsRaw < 1_000_000_000_000 ? tmsRaw * 1000 : tmsRaw;
  const day = new Date(tms).toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  into.byDay[day] = (into.byDay[day] ?? 0) + ch;
  into.byMonth[month] = (into.byMonth[month] ?? 0) + ch;
  const emailRaw = [row.email, row.userEmail, row.memberEmail, row.username, row.user].find((v) => typeof v === 'string');
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const repo = extractUsageEventRepoFromRow(row);
  if (email !== '') {
    into.byDeveloper[email] = (into.byDeveloper[email] ?? 0) + ch;
    into.byMonthDeveloper[`${month}\t${email}`] = (into.byMonthDeveloper[`${month}\t${email}`] ?? 0) + ch;
  }
  if (repo !== '') {
    into.byRepo[repo] = (into.byRepo[repo] ?? 0) + ch;
  }
  if (repo !== '' && email !== '') {
    into.byRepoDeveloper[`${repo}\t${email}`] = (into.byRepoDeveloper[`${repo}\t${email}`] ?? 0) + ch;
  }
  return true;
}

async function fetchChargedByDay(
  apiKey: string,
  startMs: number,
  endMs: number,
  policy: UsageEventsFetchPolicy,
): Promise<
  CursorAdminResult<{
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
  }>
> {
  const byDay: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byDeveloper: Record<string, number> = {};
  const byRepo: Record<string, number> = {};
  const byRepoDeveloper: Record<string, number> = {};
  const byMonthDeveloper: Record<string, number> = {};
  let eventsRead = 0;
  let truncated = false;
  const warnings: string[] = [];
  let usageEventsTotalReported = 0;
  let reportedChunks = 0;
  let usageEventHttpCalls = 0;
  let usageEventRowsReturned = 0;

  const startIso = new Date(startMs).toISOString().slice(0, 10);
  const endIso = new Date(endMs).toISOString().slice(0, 10);
  const dayKeys = eachIsoDayInclusive(startIso, endIso);

  for (const day of dayKeys) {
    const chunkStart = Math.max(startMs, Date.parse(`${day}T00:00:00.000Z`));
    const chunkEnd = Math.min(endMs, Date.parse(`${day}T23:59:59.999Z`));
    if (chunkStart > chunkEnd) continue;

    let dayEventObjects = 0;
    let reportedForDay: number | undefined;
    let page = 1;

    while (page <= policy.maxPagesPerDay) {
      if (usageEventHttpCalls > 0) {
        await sleep(policy.requestDelayMs);
      }
      usageEventHttpCalls += 1;
      const { status, text } = await adminPostRaw(apiKey, '/teams/filtered-usage-events', {
        startDate: chunkStart,
        endDate: chunkEnd,
        page,
        pageSize: 100,
      });
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        return { ok: false, status, message: text.slice(0, 240) };
      }
      if (!status.toString().startsWith('2')) {
        if (page === 1) {
          const msg =
            typeof raw === 'object' && raw !== null && 'message' in raw
              ? String((raw as { message: string }).message)
              : text.slice(0, 240);
          return { ok: false, status, message: msg || `HTTP ${status}` };
        }
        warnings.push(`Usage events: HTTP ${status} on ${day} page ${String(page)} — partial data for that day.`);
        truncated = true;
        break;
      }
      if (!raw || typeof raw !== 'object') break;
      const o = raw as {
        usageEvents?: unknown;
        pagination?: { hasNextPage?: boolean; numPages?: number };
        totalUsageEventsCount?: number;
      };
      if (page === 1 && typeof o.totalUsageEventsCount === 'number' && Number.isFinite(o.totalUsageEventsCount)) {
        reportedForDay = o.totalUsageEventsCount;
        usageEventsTotalReported += reportedForDay;
        reportedChunks += 1;
      }
      const ev = Array.isArray(o.usageEvents) ? o.usageEvents : [];
      dayEventObjects += ev.length;
      usageEventRowsReturned += ev.length;
      for (const row of ev) {
        if (!row || typeof row !== 'object') continue;
        if (mergeChargedEventRow(row as Record<string, unknown>, { byDay, byMonth, byDeveloper, byRepo, byRepoDeveloper, byMonthDeveloper })) {
          eventsRead += 1;
        }
      }

      const pag = o.pagination;
      const hasNext = pag?.hasNextPage === true;
      if (!hasNext) {
        if (reportedForDay != null && dayEventObjects < reportedForDay) {
          truncated = true;
          warnings.push(
            `Usage events: ${day} reported ${String(reportedForDay)} events but only ${String(dayEventObjects)} rows returned across pages — pagination may have stopped early.`,
          );
        }
        break;
      }
      page += 1;
    }

    if (page > policy.maxPagesPerDay) {
      truncated = true;
      warnings.push(`Usage events: ${day} hit max pages (${String(policy.maxPagesPerDay)}) — raise CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY.`);
    }
  }

  if (reportedChunks > 0 && usageEventsTotalReported > 0 && usageEventRowsReturned < usageEventsTotalReported) {
    truncated = true;
    warnings.push(
      `Usage events: HTTP returned ${String(usageEventRowsReturned)} event rows vs API-reported total ${String(usageEventsTotalReported)} — not all pages loaded.`,
    );
  }

  const out: {
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
  } = {
    byDay,
    byMonth,
    byDeveloper,
    byRepo,
    byRepoDeveloper,
    byMonthDeveloper,
    eventsRead,
    truncated,
  };
  if (usageEventRowsReturned > 0 || reportedChunks > 0) {
    out.usageEventRowsReturned = usageEventRowsReturned;
  }
  if (reportedChunks > 0) {
    out.usageEventsTotalReported = usageEventsTotalReported;
  }
  if (warnings.length > 0) {
    out.warnings = warnings;
  }
  return { ok: true, data: out };
}

async function readBillingCache(
  path: string,
  ttlMs: number,
  startMs: number,
  endMs: number,
  usageEventsPolicy: CursorUsageEventsCachePolicy | null,
): Promise<CursorBillingSnapshot | null> {
  try {
    const fs = await import('node:fs/promises');
    const st = await fs.stat(path);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    const text = await fs.readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const env = parsed as CacheEnvelope & { usageEventsMaxPages?: number };
    if (typeof env.fetchedAt !== 'string' || !env.snapshot) return null;
    if (env.startMs !== startMs || env.endMs !== endMs) return null;
    if (usageEventsPolicy === null) {
      if (env.usageEventsPolicy !== null) return null;
    } else {
      if (
        !env.usageEventsPolicy ||
        env.usageEventsPolicy.v !== usageEventsPolicy.v ||
        env.usageEventsPolicy.requestDelayMs !== usageEventsPolicy.requestDelayMs ||
        env.usageEventsPolicy.maxPagesPerDay !== usageEventsPolicy.maxPagesPerDay
      ) {
        return null;
      }
    }
    return env.snapshot;
  } catch {
    return null;
  }
}

async function writeBillingCache(
  path: string,
  snapshot: CursorBillingSnapshot,
  startMs: number,
  endMs: number,
  usageEventsPolicy: CursorUsageEventsCachePolicy | null,
): Promise<void> {
  const fs = await import('node:fs/promises');
  const pathMod = await import('node:path');
  const dir = pathMod.dirname(path);
  await fs.mkdir(dir, { recursive: true });
  const envelope: CacheEnvelope = {
    fetchedAt: new Date().toISOString(),
    startMs,
    endMs,
    usageEventsPolicy,
    snapshot,
  };
  await fs.writeFile(path, JSON.stringify(envelope, null, 2), 'utf8');
}

export async function fetchCursorBillingSnapshot(options: {
  apiKey: string;
  cachePath: string;
  cacheTtlMs: number;
  startMs: number;
  endMs: number;
  /** When null, skip `/teams/filtered-usage-events` (empty charged aggregates). */
  usageEventsPolicy: CursorUsageEventsCachePolicy | null;
}): Promise<CursorBillingSnapshot> {
  const { apiKey, cachePath, cacheTtlMs, startMs, endMs, usageEventsPolicy } = options;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return {
      spend: { ok: false, status: 0, message: 'Invalid date range for billing' },
      dailyByDay: { ok: false, status: 0, message: 'Invalid date range for billing' },
      chargedByDay: { ok: false, status: 0, message: 'Invalid date range for billing' },
    };
  }
  const cached = await readBillingCache(cachePath, cacheTtlMs, startMs, endMs, usageEventsPolicy);
  if (cached) return cached;

  const spend = await fetchSpend(apiKey);
  const dailyByDay = await fetchDailyRangeAggregated(apiKey, startMs, endMs);
  const chargedByDay =
    usageEventsPolicy !== null
      ? await fetchChargedByDay(apiKey, startMs, endMs, {
          requestDelayMs: usageEventsPolicy.requestDelayMs,
          maxPagesPerDay: usageEventsPolicy.maxPagesPerDay,
        })
      : {
          ok: true as const,
          data: {
            byDay: {},
            byMonth: {},
            byDeveloper: {},
            byRepo: {},
            byRepoDeveloper: {},
            byMonthDeveloper: {},
            eventsRead: 0,
            truncated: false,
          },
        };

  const snapshot: CursorBillingSnapshot = { spend, dailyByDay, chargedByDay };
  const spendOk = spend.ok;
  const dailyOk = dailyByDay.ok;
  const chargedOk = chargedByDay.ok;
  if (spendOk || dailyOk || chargedOk) {
    await writeBillingCache(cachePath, snapshot, startMs, endMs, usageEventsPolicy);
  }
  return snapshot;
}

export function isoRangeToMs(startIso: string, endIso: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${startIso}T00:00:00.000Z`);
  const endMs = Date.parse(`${endIso}T23:59:59.999Z`);
  return { startMs, endMs };
}
