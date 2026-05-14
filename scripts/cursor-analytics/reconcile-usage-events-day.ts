/**
 * One-day reconciliation: fully paginate `/teams/filtered-usage-events` for a UTC calendar day
 * and print team charged cents + per-email sums (compare to Cursor.com Usage for that day).
 *
 * Usage: npx tsx scripts/cursor-analytics/reconcile-usage-events-day.ts 2026-05-13
 * Env: CURSOR_ADMIN_API_KEY (from .env.local when run from repo root with dotenv)
 */

import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

const CURSOR_API = 'https://api.cursor.com';

interface UsageEventsPage {
  usageEvents?: unknown[];
  pagination?: { hasNextPage?: boolean };
  totalUsageEventsCount?: number;
}

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

function parseChargedRow(row: Record<string, unknown>): { cents: number; email: string } | null {
  const chRaw = row.chargedCents;
  const ch =
    typeof chRaw === 'number'
      ? chRaw
      : typeof chRaw === 'string'
        ? Number.parseFloat(chRaw)
        : Number.NaN;
  if (!Number.isFinite(ch)) return null;
  const emailRaw = [row.email, row.userEmail, row.memberEmail].find((v) => typeof v === 'string');
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  return { cents: ch, email };
}

async function main(): Promise<void> {
  loadEnv();
  const day = process.argv[2]?.trim();
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    console.error('Usage: npx tsx scripts/cursor-analytics/reconcile-usage-events-day.ts YYYY-MM-DD');
    process.exit(1);
  }
  const apiKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ?? '';
  if (apiKey === '') {
    console.error('Missing CURSOR_ADMIN_API_KEY');
    process.exit(1);
  }

  const startMs = Date.parse(`${day}T00:00:00.000Z`);
  const endMs = Date.parse(`${day}T23:59:59.999Z`);
  const delayMs = Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_REQUEST_DELAY_MS ?? '', 10) || 3100;
  const maxPages = Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY ?? '', 10) || 50_000;

  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  let page = 1;
  let pagesRead = 0;
  let totalCents = 0;
  const byEmail: Record<string, number> = {};
  let rows = 0;
  let reported: number | undefined;

  while (page <= maxPages) {
    if (pagesRead > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const res = await fetch(`${CURSOR_API}/teams/filtered-usage-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ startDate: startMs, endDate: endMs, page, pageSize: 100 }),
    });
    const text = await res.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      console.error('Invalid JSON', text.slice(0, 200));
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`HTTP ${String(res.status)}`, text.slice(0, 300));
      process.exit(1);
    }
    if (!raw || typeof raw !== 'object') break;
    const o = raw as UsageEventsPage;
    if (page === 1 && typeof o.totalUsageEventsCount === 'number') {
      reported = o.totalUsageEventsCount;
    }
    const ev = Array.isArray(o.usageEvents) ? o.usageEvents : [];
    rows += ev.length;
    pagesRead += 1;
    for (const item of ev) {
      if (!item || typeof item !== 'object') continue;
      const parsed = parseChargedRow(item as Record<string, unknown>);
      if (!parsed) continue;
      totalCents += parsed.cents;
      if (parsed.email !== '') {
        byEmail[parsed.email] = (byEmail[parsed.email] ?? 0) + parsed.cents;
      }
    }
    if (o.pagination?.hasNextPage !== true) break;
    page += 1;
  }

  console.log(`UTC day ${day}`);
  console.log(`HTTP pages read: ${String(pagesRead)}`);
  console.log(`Event rows (objects): ${String(rows)}`);
  if (reported != null) {
    console.log(`API totalUsageEventsCount (page 1): ${String(reported)}`);
  }
  console.log(`Sum chargedCents (team): ${totalCents.toFixed(4)} (= $${(totalCents / 100).toFixed(2)})`);
  const emails = Object.entries(byEmail).sort((a, b) => b[1] - a[1]);
  console.log('Per email (charged cents):');
  for (const [em, cents] of emails.slice(0, 40)) {
    console.log(`  ${em}\t${cents.toFixed(4)}`);
  }
  if (emails.length > 40) {
    console.log(`  … ${String(emails.length - 40)} more`);
  }
  if (reported != null && rows < reported) {
    console.error('Mismatch: rows < reported total — increase max pages or check API.');
    process.exit(2);
  }
}

void main();
