import fs from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { CURSOR_ANALYTICS_SUMMARY_JSON_REL } from '@/constants/cursorAnalyticsPaths';
import {
  fetchCursorAgentEditsCached,
  monthKeysToIsoRange,
} from '@/lib/cursorAnalyticsEnterpriseApi';
import { fetchCursorBillingQuick, isoRangeToMs } from '@/lib/cursorAdminApi';
import { getBillingStoreStatus, loadBillingForRange } from '@/lib/cursorBillingStore';
import type { CursorAnalyticsApiResponseBody } from '@/types/cursorAnalytics';
import { assertCursorAnalyticsApiAuthorized } from '@/lib/cursorAnalyticsApiAuth';
import { parseCursorAnalyticsSummary } from '@/utils/cursorAnalyticsSummary';

export const dynamic = 'force-dynamic';

const ENTERPRISE_CACHE_MS = 6 * 60 * 60 * 1000;

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

/** Team Admin billing — opt-in so `/cursor-analytics` CSV mode does not hit Cursor cloud. */
function parseIncludeAdmin(searchParams: URLSearchParams): 'none' | 'quick' | 'full' {
  const v = searchParams.get('includeAdmin');
  if (v === null) return 'none';
  const t = v.trim().toLowerCase();
  if (t === 'quick') return 'quick';
  if (t === '1' || t === 'true' || t === 'yes') return 'full';
  return 'none';
}

function resolveSummaryPath(): string {
  const raw = process.env.CURSOR_ANALYTICS_SUMMARY_JSON;
  if (!raw || raw.trim() === '') {
    return path.join(
      /* turbopackIgnore: true */ process.cwd(),
      CURSOR_ANALYTICS_SUMMARY_JSON_REL,
    );
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

export async function GET(request: Request) {
  const denied = await assertCursorAnalyticsApiAuthorized(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const filePath = resolveSummaryPath();
  const requested = deriveRange(searchParams);
  const includeAdmin = parseIncludeAdmin(searchParams);
  const warnings: string[] = [];
  const range = requested;

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

  if (includeAdmin !== 'none' && apiKey !== '' && !skipAdmin) {
    const { startMs, endMs } = isoRangeToMs(range.startDate, range.endDate);
    const billing = await fetchCursorBillingQuick({ apiKey, startMs, endMs });

    let billingStore = await getBillingStoreStatus(range.startDate, range.endDate);

    if (includeAdmin === 'full') {
      const storeLoad = await loadBillingForRange(range.startDate, range.endDate);
      billingStore = storeLoad.status;
      if (storeLoad.message) {
        warnings.push(storeLoad.message);
      }
      if (storeLoad.chargedByDay.ok && storeLoad.chargedByDay.data.warnings) {
        for (const w of storeLoad.chargedByDay.data.warnings) {
          warnings.push(w);
        }
      }
      body = {
        ...body,
        billing: {
          ...billing,
          chargedByDay: storeLoad.chargedByDay,
        },
        billingStore,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } else {
      body = {
        ...body,
        billing,
        billingStore,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  } else if (includeAdmin === 'full' && apiKey === '') {
    warnings.push('CURSOR_ADMIN_API_KEY not set — billing store and live Admin API unavailable.');
    const billingStore = await getBillingStoreStatus(range.startDate, range.endDate);
    body = {
      ...body,
      billingStore,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  if (includeAdmin !== 'none' && body.loaded && body.summary && apiKey !== '' && includeAgentEdits) {
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
