'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { InputSwitch } from 'primereact/inputswitch';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';

import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';
import { useTheme } from '@/providers/ThemeProvider';
import type {
  CursorAnalyticsApiResponseBody,
  CursorAnalyticsMonetarySource,
  CursorAnalyticsSummary,
} from '@/types/cursorAnalytics';
import { isCursorChargedByDayTruncated } from '@/utils/cursorAnalyticsBillingGuards';
import { computeCsvMoneyEstimate, sumUsageRequestsInRange } from '@/utils/cursorAnalyticsCsvModelMoneyEstimate';
import { eachIsoDayInclusive } from '@/utils/cursorAnalyticsTeamTrend';
import { formatUsdFromCents, formatUsdNumber } from '@/utils/cursorBillingFormat';

import { CursorAnalyticsDataPanels } from './CursorAnalyticsDataPanels';
import styles from './CursorAnalyticsDashboard.module.scss';

const MONETARY_SOURCE_STORAGE_KEY = 'cursor-analytics-monetary-source';

function readMonetarySource(): CursorAnalyticsMonetarySource {
  if (typeof window === 'undefined') return 'csv_estimate';
  try {
    const v = window.localStorage.getItem(MONETARY_SOURCE_STORAGE_KEY);
    if (v === 'api') return 'api';
    return 'csv_estimate';
  } catch {
    return 'csv_estimate';
  }
}

function formatPeriod(months: string[]): string {
  const valid = months.filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (valid.length === 0) return '—';
  if (valid.length === 1) return valid[0];
  return `${valid[0]} → ${valid[valid.length - 1]}`;
}

function isoDayFromOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((sum, value) => sum + value, 0);
}

function developerCount(summary: CursorAnalyticsSummary): number {
  const keys = Object.keys(summary.byDeveloper).filter((k) => k !== '_team');
  if (keys.length > 0) return keys.length;
  return Object.keys(summary.byDeveloper).length;
}

export const CursorAnalyticsDashboard = () => {
  const { cycleTheme } = useTheme();
  const [summary, setSummary] = useState<CursorAnalyticsSummary | null>(null);
  const [enterprise, setEnterprise] = useState<CursorEnterpriseFetchResult | undefined>();
  const [billing, setBilling] = useState<CursorBillingSnapshot | undefined>();
  const [range, setRange] = useState<{ startDate: string; endDate: string }>({
    startDate: isoDayFromOffset(-90),
    endDate: isoDayFromOffset(0),
  });
  const [draftRange, setDraftRange] = useState<{ startDate: string; endDate: string }>({
    startDate: isoDayFromOffset(-90),
    endDate: isoDayFromOffset(0),
  });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [monetarySource, setMonetarySource] = useState<CursorAnalyticsMonetarySource>('csv_estimate');

  // One-shot: read persisted toggle after mount (localStorage not in prerender snapshot).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional hydration from localStorage
  useEffect(() => {
    setMonetarySource(readMonetarySource());
  }, []);

  const setMonetarySourceAndPersist = useCallback((next: CursorAnalyticsMonetarySource) => {
    setMonetarySource(next);
    try {
      window.localStorage.setItem(MONETARY_SOURCE_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const setPreset = useCallback(
    (preset: 'sprint' | 'month' | 'quarter' | 'all') => {
      if (preset === 'sprint') {
        const next = { startDate: isoDayFromOffset(-13), endDate: isoDayFromOffset(0) };
        setDraftRange(next);
        setRange(next);
        return;
      }
      if (preset === 'month') {
        const next = { startDate: isoDayFromOffset(-29), endDate: isoDayFromOffset(0) };
        setDraftRange(next);
        setRange(next);
        return;
      }
      if (preset === 'quarter') {
        const next = { startDate: isoDayFromOffset(-89), endDate: isoDayFromOffset(0) };
        setDraftRange(next);
        setRange(next);
        return;
      }
      if (summary) {
        const keys = Object.keys(summary.byDay).sort();
        if (keys.length > 0) {
          const next = { startDate: keys[0], endDate: keys[keys.length - 1] };
          setDraftRange(next);
          setRange(next);
        }
      }
    },
    [summary],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      });
      if (monetarySource === 'api') {
        params.set('includeAdmin', '1');
      }
      const res = await fetch(`/api/cursor-analytics?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setSummary(null);
        setEnterprise(undefined);
        setBilling(undefined);
        setApiWarnings([]);
        setLoaded(false);
        return;
      }
      const body = (await res.json()) as CursorAnalyticsApiResponseBody;
      setLoaded(body.loaded);
      setSummary(body.loaded ? body.summary : null);
      setEnterprise(body.enterprise);
      setBilling(body.billing);
      setApiWarnings(body.warnings ?? []);
      if (body.range.startDate !== range.startDate || body.range.endDate !== range.endDate) {
        setRange(body.range);
      }
      setDraftRange(body.range);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setSummary(null);
      setEnterprise(undefined);
      setBilling(undefined);
      setApiWarnings([]);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [range.endDate, range.startDate, monetarySource]);

  useEffect(() => {
    void load();
  }, [load]);

  const cycleOverallCents = useMemo(() => {
    if (billing?.spend.ok !== true) return null;
    return billing.spend.data.members.reduce((sum, member) => sum + member.overallSpendCents, 0);
  }, [billing]);

  const chargedByDayTruncated = useMemo(() => isCursorChargedByDayTruncated(billing), [billing]);

  const csvMoneyEstimate = useMemo(() => {
    if (!loaded || !summary) return null;
    const chargedByDayCents =
      billing?.chargedByDay.ok === true ? billing.chargedByDay.data.byDay : undefined;
    return computeCsvMoneyEstimate({
      summary,
      range,
      chargedByDayCents,
      disableCalibration: chargedByDayTruncated,
    });
  }, [loaded, summary, range, billing, chargedByDayTruncated]);

  const kpiItems: KpiItem[] = useMemo(() => {
    if (!loaded) {
      return [
        { label: 'Cycle billed (team)', value: '—', onActivate: cycleTheme },
        { label: 'Period', value: '—' },
        { label: 'Charged (range)', value: '—' },
        { label: 'Team members', value: '—' },
        { label: '$ / req', value: '—' },
        { label: 'Usage reqs', value: '—' },
      ];
    }

    const cycleSpendCents =
      billing?.spend.ok === true
        ? billing.spend.data.members.reduce((sum, member) => sum + member.spendCents, 0)
        : null;

    const usageReqsFromCsv = summary ? sumUsageRequestsInRange(summary, range) : 0;

    const chargedCentsApi = billing?.chargedByDay.ok === true ? sumValues(billing.chargedByDay.data.byDay) : null;
    const usageReqsApi = billing?.dailyByDay.ok === true ? sumValues(billing.dailyByDay.data.usageBasedByDay) : null;

    const chargedCents =
      monetarySource === 'csv_estimate' && csvMoneyEstimate != null
        ? csvMoneyEstimate.totalRangeCents
        : chargedCentsApi;
    const usageReqs = monetarySource === 'csv_estimate' ? usageReqsFromCsv : usageReqsApi;
    const usdPerReq =
      chargedCents != null && usageReqs != null && usageReqs > 0 ? chargedCents / 100 / usageReqs : null;
    const memberCount =
      billing?.spend.ok === true ? billing.spend.data.members.length : summary ? developerCount(summary) : 0;

    const chargedLabel = monetarySource === 'csv_estimate' ? 'Est. charged (range)' : 'Charged (range)';
    const usageLabel = monetarySource === 'csv_estimate' ? 'Usage reqs (CSV)' : 'Usage reqs';

    return [
      {
        label: 'Cycle billed (team)',
        value: cycleSpendCents != null ? formatUsdFromCents(cycleSpendCents) : '—',
        onActivate: cycleTheme,
      },
      { label: 'Period', value: `${range.startDate} → ${range.endDate}` },
      {
        label: chargedLabel,
        value: chargedCents != null ? formatUsdFromCents(chargedCents) : '—',
      },
      {
        label: 'Team members',
        value: memberCount.toLocaleString(),
      },
      {
        label: '$ / req',
        value: usdPerReq != null ? formatUsdNumber(usdPerReq) : '—',
      },
      {
        label: usageLabel,
        value: usageReqs != null && usageReqs > 0 ? usageReqs.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
      },
    ];
  }, [
    loaded,
    summary,
    billing,
    cycleTheme,
    range.endDate,
    range.startDate,
    monetarySource,
    csvMoneyEstimate,
  ]);

  const toolbarBillingHint = useMemo(() => {
    if (monetarySource === 'csv_estimate' && billing === undefined) {
      return ' · Cursor Admin API not loaded (CSV mode — toggle Monetary to API + Refresh for billing)';
    }
    if (!billing) return '';
    const okSpend = billing.spend.ok;
    const okDaily = billing.dailyByDay.ok;
    const okEvents = billing.chargedByDay.ok;
    if (okSpend || okDaily || okEvents) {
      const parts: string[] = [];
      if (okSpend) parts.push('spend');
      if (okDaily) parts.push('daily');
      if (okEvents) parts.push('events');
      return ` · Billing ${parts.join('+')}`;
    }
    return ' · Billing unavailable';
  }, [billing, monetarySource]);

  const suspectLowDailyCostVsActivity = useMemo(() => {
    if (monetarySource === 'csv_estimate') return false;
    if (!billing?.chargedByDay.ok || !billing.dailyByDay.ok) return false;
    if (
      billing.chargedByDay.data.truncated ||
      (typeof billing.chargedByDay.data.usageEventsTotalReported === 'number' &&
        billing.chargedByDay.data.usageEventsTotalReported > 0 &&
        typeof billing.chargedByDay.data.usageEventRowsReturned === 'number' &&
        billing.chargedByDay.data.usageEventRowsReturned < billing.chargedByDay.data.usageEventsTotalReported)
    ) {
      return false;
    }
    const days = eachIsoDayInclusive(range.startDate, range.endDate);
    const usage = billing.dailyByDay.data.usageBasedByDay;
    const inc = billing.dailyByDay.data.includedByDay;
    const byDay = billing.chargedByDay.data.byDay;
    for (const d of days) {
      const usd = (byDay[d] ?? 0) / 100;
      const reqs = (usage[d] ?? 0) + (inc[d] ?? 0);
      if (reqs >= 500 && usd > 0 && usd < 50) return true;
    }
    return false;
  }, [billing, range]);

  return (
    <main className={styles.root} aria-label="Cursor analytics">
      <div className={styles.layout}>
        <div className={styles.kpiRow}>
          <KpiStrip items={kpiItems} />
        </div>
        {apiWarnings.map((w) => (
          <Message key={w} className={styles.apiMessage} severity="warn" text={w} />
        ))}
        {loaded && summary && monetarySource === 'csv_estimate' ? (
          <Message
            className={styles.apiMessage}
            severity="info"
            text="CSV mode: dollars are estimates from your team export and public list $/M — not Cursor billing. Daily costs are scaled to match Chats Usage Based Requests when model request counts are only a partial slice of that line."
          />
        ) : null}
        {suspectLowDailyCostVsActivity ? (
          <Message
            className={styles.apiMessage}
            severity="warn"
            text="Heuristic: at least one day has high team request volume but low event-charged USD — double-check Trend vs Cursor Usage for that day (timezone UTC vs local)."
          />
        ) : null}
        {loaded && billing?.spend.ok === true && cycleOverallCents !== null ? (
          <p className={styles.billingSemanticsHint}>
            <strong>Cycle overall (team, API):</strong> {formatUsdFromCents(cycleOverallCents)} — sum of per-member{' '}
            <code>overallSpendCents</code> for the <em>current subscription cycle</em> from <code>/teams/spend</code> (not
            lifetime all-time). Compare to <strong>Cycle billed</strong> (sum <code>spendCents</code>) when included
            allowance is reported separately.
          </p>
        ) : null}
        <div className={styles.toolbar}>
          <Button
            type="button"
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            loading={loading}
            onClick={() => void load()}
          />
          {loaded && summary ? (
            <label className={styles.monetaryToggle}>
              <span className={styles.monetaryToggleLabel}>Monetary: API</span>
              <InputSwitch
                checked={monetarySource === 'csv_estimate'}
                onChange={(e) => setMonetarySourceAndPersist(e.value ? 'csv_estimate' : 'api')}
                aria-label="Toggle monetary source between Admin API and CSV model estimate"
              />
              <span className={styles.monetaryToggleLabel}>CSV est.</span>
            </label>
          ) : null}
          <div className={styles.rangeControls}>
            <Button type="button" label="Sprint" size="small" outlined onClick={() => setPreset('sprint')} />
            <Button type="button" label="Month" size="small" outlined onClick={() => setPreset('month')} />
            <Button type="button" label="Quarter" size="small" outlined onClick={() => setPreset('quarter')} />
            <Button type="button" label="All" size="small" outlined onClick={() => setPreset('all')} />
            <input
              type="date"
              value={draftRange.startDate}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
            <input
              type="date"
              value={draftRange.endDate}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              label="Apply range"
              size="small"
              onClick={() => {
                if (draftRange.startDate !== '' && draftRange.endDate !== '') {
                  setRange(draftRange);
                }
              }}
            />
          </div>
          {loaded && summary ? (
            <span className={styles.meta}>
              CSV baseline {formatPeriod(Object.keys(summary.byMonth))} · generated{' '}
              {new Date(summary.generatedAt).toLocaleString()}
              {toolbarBillingHint}
              {' · '}
              <span className={styles.noAutoRefresh}>No auto-refresh — use Refresh for latest.</span>
            </span>
          ) : null}
        </div>

        {error ? <Message severity="error" text={error} className={styles.banner} /> : null}

        {loading && !loaded ? (
          <div className={styles.skeletonStack}>
            <Skeleton height="2rem" />
            <Skeleton height="12rem" />
          </div>
        ) : null}

        {!loading && !loaded ? (
          <Message severity="info" text="No summary data loaded." className={styles.banner} />
        ) : null}

        {loaded && summary ? (
          <CursorAnalyticsDataPanels
            summary={summary}
            enterprise={enterprise}
            billing={billing}
            range={range}
            monetarySource={monetarySource}
            csvMoneyEstimate={csvMoneyEstimate}
          />
        ) : null}
      </div>
    </main>
  );
};
