import fs from 'node:fs/promises';
import path from 'node:path';

const CURSOR_API_BASE = 'https://api.cursor.com';

export interface CursorEnterpriseAgentEditDay {
  event_date: string;
  total_lines_accepted: number;
  total_lines_suggested: number;
}

export type CursorEnterpriseFetchResult =
  | { ok: true; agentEdits: CursorEnterpriseAgentEditDay[]; fetchedAt: string; fromCache: boolean }
  | { ok: false; status: number; message: string; fromCache: boolean };

function isAgentEditDay(value: object): value is CursorEnterpriseAgentEditDay {
  const o = value as CursorEnterpriseAgentEditDay;
  return (
    typeof o.event_date === 'string' &&
    typeof o.total_lines_accepted === 'number' &&
    typeof o.total_lines_suggested === 'number'
  );
}

function parseAgentEditsPayload(raw: unknown): CursorEnterpriseAgentEditDay[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const out: CursorEnterpriseAgentEditDay[] = [];
  for (const row of data) {
    if (typeof row === 'object' && row !== null && isAgentEditDay(row)) {
      out.push(row);
    }
  }
  return out;
}

interface CacheEnvelope {
  fetchedAt: string;
  result: CursorEnterpriseFetchResult;
}

async function readCache(cachePath: string, ttlMs: number): Promise<CursorEnterpriseFetchResult | null> {
  try {
    const st = await fs.stat(cachePath);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    const text = await fs.readFile(cachePath, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const env = parsed as CacheEnvelope;
    if (typeof env.fetchedAt !== 'string' || !env.result) return null;
    return env.result;
  } catch {
    return null;
  }
}

async function writeCache(cachePath: string, result: CursorEnterpriseFetchResult): Promise<void> {
  const dir = path.dirname(cachePath);
  await fs.mkdir(dir, { recursive: true });
  const envelope: CacheEnvelope = { fetchedAt: new Date().toISOString(), result };
  await fs.writeFile(cachePath, JSON.stringify(envelope, null, 2), 'utf8');
}

/**
 * Fetches Cursor Enterprise Analytics `agent-edits` (admin API key). Cached on disk to limit calls.
 * Returns `ok: false` when key missing, network error, or non-Enterprise (403).
 */
export async function fetchCursorAgentEditsCached(options: {
  apiKey: string | undefined;
  cachePath: string;
  cacheTtlMs: number;
  startDate: string;
  endDate: string;
}): Promise<CursorEnterpriseFetchResult> {
  const { apiKey, cachePath, cacheTtlMs, startDate, endDate } = options;
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, status: 0, message: 'CURSOR_ADMIN_API_KEY not set', fromCache: false };
  }

  const cached = await readCache(cachePath, cacheTtlMs);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const url = new URL(`${CURSOR_API_BASE}/analytics/team/agent-edits`);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, status: res.status, message: text.slice(0, 200), fromCache: false };
    }

    if (!res.ok) {
      const msg =
        typeof json === 'object' && json !== null && 'message' in json
          ? String((json as { message: string }).message)
          : text.slice(0, 200);
      return { ok: false, status: res.status, message: msg || res.statusText, fromCache: false };
    }

    const rows = parseAgentEditsPayload(json);
    if (!rows) {
      return {
        ok: false,
        status: res.status,
        message: 'Unexpected agent-edits JSON shape',
        fromCache: false,
      };
    }

    const ok: CursorEnterpriseFetchResult = {
      ok: true,
      agentEdits: rows,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };
    await writeCache(cachePath, ok);
    return ok;
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'fetch failed',
      fromCache: false,
    };
  }
}

/** Derive `YYYY-MM-DD` bounds from summary `byMonth` keys (`YYYY-MM`). */
export function monthKeysToIsoRange(byMonth: Record<string, { rows: number; amount: number }>): {
  startDate: string;
  endDate: string;
} {
  const keys = Object.keys(byMonth)
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort();
  if (keys.length === 0) {
    const t = new Date();
    const end = t.toISOString().slice(0, 10);
    const start = new Date(t.getTime() - 45 * 86400000).toISOString().slice(0, 10);
    return { startDate: start, endDate: end };
  }
  const first = keys[0];
  const last = keys[keys.length - 1];
  const [y1, m1] = first.split('-').map(Number) as [number, number];
  const [y2, m2] = last.split('-').map(Number) as [number, number];
  const startDate = `${String(y1).padStart(4, '0')}-${String(m1).padStart(2, '0')}-01`;
  const lastDay = new Date(y2, m2, 0).getDate();
  const endDate = `${String(y2).padStart(4, '0')}-${String(m2).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}
