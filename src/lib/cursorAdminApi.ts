/**
 * Cursor **Admin** REST API (team owner key) — billing & usage.
 * See https://cursor.com/docs/account/teams/admin-api
 *
 * Not the same as **Enterprise Analytics** (`/analytics/team/*`), which returns 401 unless the org is on Enterprise.
 */

const CURSOR_API = 'https://api.cursor.com';

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
  /** Sum `chargedCents` from `/teams/filtered-usage-events` (paginated; may be truncated). */
  chargedByDay: CursorAdminResult<{
    byDay: Record<string, number>;
    byMonth: Record<string, number>;
    byDeveloper: Record<string, number>;
    byRepo: Record<string, number>;
    byRepoDeveloper: Record<string, number>;
    byMonthDeveloper: Record<string, number>;
    eventsRead: number;
    truncated: boolean;
  }>;
}

interface CacheEnvelope {
  fetchedAt: string;
  startMs: number;
  endMs: number;
  usageEventsMaxPages: number;
  snapshot: CursorBillingSnapshot;
}

async function adminPostRaw(
  apiKey: string,
  path: string,
  body: object,
): Promise<{ status: number; text: string }> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const res = await fetch(`${CURSOR_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, text };
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
async function fetchDailyRangeAggregated(
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

async function fetchChargedByDay(
  apiKey: string,
  startMs: number,
  endMs: number,
  maxPages: number,
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

  for (let page = 1; page <= maxPages; page++) {
    const { status, text } = await adminPostRaw(apiKey, '/teams/filtered-usage-events', {
      startDate: startMs,
      endDate: endMs,
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
      break;
    }
    if (!raw || typeof raw !== 'object') break;
    const o = raw as {
      usageEvents?: unknown;
      pagination?: { hasNextPage?: boolean; numPages?: number };
    };
    const ev = Array.isArray(o.usageEvents) ? o.usageEvents : [];
    for (const row of ev) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const ts = r.timestamp;
      const chRaw = r.chargedCents;
      if (typeof ts !== 'string' && typeof ts !== 'number') continue;
      const ch =
        typeof chRaw === 'number'
          ? chRaw
          : typeof chRaw === 'string'
            ? Number.parseFloat(chRaw)
            : Number.NaN;
      if (!Number.isFinite(ch)) continue;
      const tmsRaw = typeof ts === 'string' ? Number.parseInt(ts, 10) : ts;
      if (!Number.isFinite(tmsRaw)) continue;
      /** Admin API uses ms strings; guard epoch-seconds if a client ever sends 10-digit values. */
      const tms = tmsRaw < 1_000_000_000_000 ? tmsRaw * 1000 : tmsRaw;
      const day = new Date(tms).toISOString().slice(0, 10);
      const month = day.slice(0, 7);
      byDay[day] = (byDay[day] ?? 0) + ch;
      byMonth[month] = (byMonth[month] ?? 0) + ch;
      const emailRaw = [r.email, r.userEmail, r.memberEmail, r.username, r.user]
        .find((v) => typeof v === 'string');
      const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
      const repoRaw = [
        r.repo,
        r.repository,
        r.repoName,
        r.repositoryName,
        r.gitRepo,
        r.remoteUrl,
        r.projectPath,
        r.workspaceRepo,
      ].find((v) => typeof v === 'string');
      const repo = typeof repoRaw === 'string' ? repoRaw.trim() : '';
      if (email !== '') {
        byDeveloper[email] = (byDeveloper[email] ?? 0) + ch;
        byMonthDeveloper[`${month}\t${email}`] = (byMonthDeveloper[`${month}\t${email}`] ?? 0) + ch;
      }
      if (repo !== '') {
        byRepo[repo] = (byRepo[repo] ?? 0) + ch;
      }
      if (repo !== '' && email !== '') {
        byRepoDeveloper[`${repo}\t${email}`] = (byRepoDeveloper[`${repo}\t${email}`] ?? 0) + ch;
      }
      eventsRead += 1;
    }

    const pag = o.pagination;
    const hasNext = pag?.hasNextPage === true;
    if (!hasNext) {
      truncated = false;
      break;
    }
    if (page >= maxPages) {
      truncated = true;
      break;
    }
  }

  return {
    ok: true,
    data: {
      byDay,
      byMonth,
      byDeveloper,
      byRepo,
      byRepoDeveloper,
      byMonthDeveloper,
      eventsRead,
      truncated,
    },
  };
}

async function readBillingCache(
  path: string,
  ttlMs: number,
  startMs: number,
  endMs: number,
  usageEventsMaxPages: number,
): Promise<CursorBillingSnapshot | null> {
  try {
    const fs = await import('node:fs/promises');
    const st = await fs.stat(path);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    const text = await fs.readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const env = parsed as CacheEnvelope;
    if (typeof env.fetchedAt !== 'string' || !env.snapshot) return null;
    if (env.startMs !== startMs || env.endMs !== endMs || env.usageEventsMaxPages !== usageEventsMaxPages) {
      return null;
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
  usageEventsMaxPages: number,
): Promise<void> {
  const fs = await import('node:fs/promises');
  const pathMod = await import('node:path');
  const dir = pathMod.dirname(path);
  await fs.mkdir(dir, { recursive: true });
  const envelope: CacheEnvelope = {
    fetchedAt: new Date().toISOString(),
    startMs,
    endMs,
    usageEventsMaxPages,
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
  /** Pages of `/teams/filtered-usage-events` (100 rows each) for $ trend; 0 = skip */
  usageEventsMaxPages: number;
}): Promise<CursorBillingSnapshot> {
  const { apiKey, cachePath, cacheTtlMs, startMs, endMs, usageEventsMaxPages } = options;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return {
      spend: { ok: false, status: 0, message: 'Invalid date range for billing' },
      dailyByDay: { ok: false, status: 0, message: 'Invalid date range for billing' },
      chargedByDay: { ok: false, status: 0, message: 'Invalid date range for billing' },
    };
  }
  const cached = await readBillingCache(cachePath, cacheTtlMs, startMs, endMs, usageEventsMaxPages);
  if (cached) return cached;

  const spend = await fetchSpend(apiKey);
  const dailyByDay = await fetchDailyRangeAggregated(apiKey, startMs, endMs);
  const chargedByDay =
    usageEventsMaxPages > 0
      ? await fetchChargedByDay(apiKey, startMs, endMs, usageEventsMaxPages)
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
    await writeBillingCache(cachePath, snapshot, startMs, endMs, usageEventsMaxPages);
  }
  return snapshot;
}

export function isoRangeToMs(startIso: string, endIso: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${startIso}T00:00:00.000Z`);
  const endMs = Date.parse(`${endIso}T23:59:59.999Z`);
  return { startMs, endMs };
}
