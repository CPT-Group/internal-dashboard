import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import {
  fetchCursorAgentEditsCached,
  monthKeysToIsoRange,
} from '@/lib/cursorAnalyticsEnterpriseApi';
import { fetchCursorBillingSnapshot, isoRangeToMs } from '@/lib/cursorAdminApi';
import type { CursorAnalyticsApiResponseBody } from '@/types/cursorAnalytics';
import { parseCursorAnalyticsSummary } from '@/utils/cursorAnalyticsSummary';

export const dynamic = 'force-dynamic';

const ENTERPRISE_CACHE_MS = 6 * 60 * 60 * 1000;
const BILLING_CACHE_MS =
  Number.parseInt(process.env.CURSOR_ANALYTICS_BILLING_CACHE_MS ?? '', 10) || 15 * 60 * 1000;
const USAGE_EVENTS_MAX_PAGES =
  Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES ?? '', 10) || 100;

function isIsoDay(value: string | null): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dayShiftIso(offsetDays: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

function deriveRange(searchParams: URLSearchParams): { startDate: string; endDate: string } {
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  if (isIsoDay(startParam) && isIsoDay(endParam)) {
    return { startDate: startParam, endDate: endParam };
  }
  return { startDate: dayShiftIso(-90), endDate: dayShiftIso(0) };
}

function resolveSummaryPath(): string {
  const raw = process.env.CURSOR_ANALYTICS_SUMMARY_JSON;
  if (!raw || raw.trim() === '') {
    return path.join(/* turbopackIgnore: true */ process.cwd(), 'kyleOutput', 'cursor-analytics-summary.json');
  }
  return path.isAbsolute(raw) ? raw : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
}

function enterpriseCachePath(): string {
  const raw = process.env.CURSOR_ANALYTICS_ENTERPRISE_CACHE_JSON;
  if (raw && raw.trim() !== '') {
    return path.isAbsolute(raw) ? raw : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'kyleOutput', 'cursor-analytics-enterprise-cache.json');
}

function billingCachePath(): string {
  const raw = process.env.CURSOR_ANALYTICS_BILLING_CACHE_JSON;
  if (raw && raw.trim() !== '') {
    return path.isAbsolute(raw) ? raw : path.join(/* turbopackIgnore: true */ process.cwd(), raw);
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), 'kyleOutput', 'cursor-admin-billing-cache.json');
}

export async function GET(request: Request) {
  const filePath = resolveSummaryPath();
  const { startDate, endDate } = deriveRange(new URL(request.url).searchParams);
  let body: CursorAnalyticsApiResponseBody = {
    loaded: false,
    summary: null,
    range: { startDate, endDate },
  };

  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    const summary = parseCursorAnalyticsSummary(parsed);
    if (!summary) {
      body = { loaded: false, summary: null, range: { startDate, endDate } };
    } else {
      body = { loaded: true, summary, range: { startDate, endDate } };
    }
  } catch {
    body = { loaded: false, summary: null, range: { startDate, endDate } };
  }

  const apiKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ?? '';
  const skipCloud = process.env.CURSOR_ANALYTICS_SKIP_CLOUD === '1';
  const skipAdmin = skipCloud || process.env.CURSOR_ANALYTICS_SKIP_ADMIN_API === '1';
  /** Enterprise Analytics (`/analytics/team/agent-edits`) — not Team billing; 401 on non-Enterprise orgs. */
  const includeAgentEdits =
    !skipCloud &&
    process.env.CURSOR_ANALYTICS_AGENT_EDITS === '1' &&
    process.env.CURSOR_ANALYTICS_SKIP_ENTERPRISE !== '1';

  if (apiKey !== '' && !skipAdmin) {
    const { startMs, endMs } = isoRangeToMs(startDate, endDate);
    const billing = await fetchCursorBillingSnapshot({
      apiKey,
      cachePath: billingCachePath(),
      cacheTtlMs: BILLING_CACHE_MS,
      startMs,
      endMs,
      usageEventsMaxPages: USAGE_EVENTS_MAX_PAGES,
    });
    body = { ...body, billing };
  }

  if (body.loaded && body.summary && apiKey !== '' && includeAgentEdits) {
    const rangeFromSummary = monthKeysToIsoRange(body.summary.byMonth);
    const enterprise = await fetchCursorAgentEditsCached({
      apiKey,
      cachePath: enterpriseCachePath(),
      cacheTtlMs: ENTERPRISE_CACHE_MS,
      startDate: rangeFromSummary.startDate,
      endDate: rangeFromSummary.endDate,
    });
    body = { ...body, enterprise };
  }

  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
