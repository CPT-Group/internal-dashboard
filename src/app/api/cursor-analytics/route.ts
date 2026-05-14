import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import {
  fetchCursorAgentEditsCached,
  monthKeysToIsoRange,
} from '@/lib/cursorAnalyticsEnterpriseApi';
import { fetchCursorBillingSnapshot, isoRangeToMs, type CursorUsageEventsCachePolicy } from '@/lib/cursorAdminApi';
import type { CursorAnalyticsApiResponseBody } from '@/types/cursorAnalytics';
import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';
import { parseCursorAnalyticsSummary } from '@/utils/cursorAnalyticsSummary';

export const dynamic = 'force-dynamic';
/** Long billing pulls (UTC-day chunked usage events + throttle) — raise on hosts that allow it. */
export const maxDuration = 300;

const ENTERPRISE_CACHE_MS = 6 * 60 * 60 * 1000;
const BILLING_CACHE_MS =
  Number.parseInt(process.env.CURSOR_ANALYTICS_BILLING_CACHE_MS ?? '', 10) || 15 * 60 * 1000;
/** `0` = skip `/teams/filtered-usage-events`; any other value enables full per-day pagination (legacy name). */
const USAGE_EVENTS_ENABLED =
  Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES ?? '', 10) !== 0;
const USAGE_EVENTS_REQUEST_DELAY_MS =
  Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_REQUEST_DELAY_MS ?? '', 10) || 3100;
const USAGE_EVENTS_MAX_PAGES_PER_DAY =
  Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY ?? '', 10) || 50_000;
const USAGE_EVENTS_MAX_RANGE_DAYS =
  Number.parseInt(process.env.CURSOR_ANALYTICS_USAGE_EVENTS_MAX_RANGE_DAYS ?? '', 10) || 120;

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

/** Team Admin billing + Enterprise agent-edits — opt-in so `/cursor-analytics` CSV mode does not hit Cursor cloud. */
function parseIncludeAdmin(searchParams: URLSearchParams): boolean {
  const v = searchParams.get('includeAdmin');
  if (v === null) return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}

/** Shorten range from the end (most recent UTC days) so usage-event ingestion can finish within server limits. */
function clipRangeToMaxDays(
  startDate: string,
  endDate: string,
  maxDays: number,
): { startDate: string; endDate: string; clipped: boolean } {
  const days = eachIsoDayInclusive(startDate, endDate);
  if (days.length <= maxDays) {
    return { startDate, endDate, clipped: false };
  }
  const slice = days.slice(-maxDays);
  const first = slice[0];
  const last = slice[slice.length - 1];
  if (!first || !last) {
    return { startDate, endDate, clipped: false };
  }
  return { startDate: first, endDate: last, clipped: true };
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
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const filePath = resolveSummaryPath();
  const requested = deriveRange(searchParams);
  const includeAdmin = parseIncludeAdmin(searchParams);
  const warnings: string[] = [];

  const clipped = clipRangeToMaxDays(requested.startDate, requested.endDate, USAGE_EVENTS_MAX_RANGE_DAYS);
  const range = clipped.clipped ? clipped : requested;
  if (clipped.clipped) {
    warnings.push(
      `Billing usage events were limited to the last ${String(USAGE_EVENTS_MAX_RANGE_DAYS)} UTC days (${range.startDate} → ${range.endDate}). Widen with env CURSOR_ANALYTICS_USAGE_EVENTS_MAX_RANGE_DAYS or choose a shorter preset. Requested: ${requested.startDate} → ${requested.endDate}.`,
    );
  }

  let body: CursorAnalyticsApiResponseBody = {
    loaded: false,
    summary: null,
    range,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(text) as unknown;
    const summary = parseCursorAnalyticsSummary(parsed);
    if (!summary) {
      body = { loaded: false, summary: null, range, warnings: warnings.length > 0 ? warnings : undefined };
    } else {
      body = { loaded: true, summary, range, warnings: warnings.length > 0 ? warnings : undefined };
    }
  } catch {
    body = { loaded: false, summary: null, range, warnings: warnings.length > 0 ? warnings : undefined };
  }

  const apiKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ?? '';
  const skipCloud = process.env.CURSOR_ANALYTICS_SKIP_CLOUD === '1';
  const skipAdmin = skipCloud || process.env.CURSOR_ANALYTICS_SKIP_ADMIN_API === '1';
  /** Enterprise Analytics (`/analytics/team/agent-edits`) — not Team billing; 401 on non-Enterprise orgs. */
  const includeAgentEdits =
    !skipCloud &&
    process.env.CURSOR_ANALYTICS_AGENT_EDITS === '1' &&
    process.env.CURSOR_ANALYTICS_SKIP_ENTERPRISE !== '1';

  if (includeAdmin && apiKey !== '' && !skipAdmin) {
    const { startMs, endMs } = isoRangeToMs(range.startDate, range.endDate);
    const usageEventsPolicy: CursorUsageEventsCachePolicy | null = USAGE_EVENTS_ENABLED
      ? {
          v: 2,
          requestDelayMs: USAGE_EVENTS_REQUEST_DELAY_MS,
          maxPagesPerDay: USAGE_EVENTS_MAX_PAGES_PER_DAY,
        }
      : null;
    const billing = await fetchCursorBillingSnapshot({
      apiKey,
      cachePath: billingCachePath(),
      cacheTtlMs: BILLING_CACHE_MS,
      startMs,
      endMs,
      usageEventsPolicy,
    });
    if (billing.chargedByDay.ok && billing.chargedByDay.data.warnings) {
      for (const w of billing.chargedByDay.data.warnings) {
        warnings.push(w);
      }
    }
    body = {
      ...body,
      billing,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  if (includeAdmin && body.loaded && body.summary && apiKey !== '' && includeAgentEdits) {
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
