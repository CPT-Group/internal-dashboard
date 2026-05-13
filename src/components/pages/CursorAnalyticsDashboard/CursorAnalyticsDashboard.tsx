'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';

import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import type { CursorBillingSnapshot } from '@/lib/cursorAdminApi';
import type { CursorEnterpriseFetchResult } from '@/lib/cursorAnalyticsEnterpriseApi';
import { useTheme } from '@/providers/ThemeProvider';
import type { CursorAnalyticsApiResponseBody, CursorAnalyticsSummary } from '@/types/cursorAnalytics';
import { formatUsdFromCents, formatUsdNumber } from '@/utils/cursorBillingFormat';

import { CursorAnalyticsDataPanels } from './CursorAnalyticsDataPanels';
import styles from './CursorAnalyticsDashboard.module.scss';

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
      const res = await fetch(`/api/cursor-analytics?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setSummary(null);
        setEnterprise(undefined);
        setBilling(undefined);
        setLoaded(false);
        return;
      }
      const body = (await res.json()) as CursorAnalyticsApiResponseBody;
      setLoaded(body.loaded);
      setSummary(body.loaded ? body.summary : null);
      setEnterprise(body.enterprise);
      setBilling(body.billing);
      if (body.range.startDate !== range.startDate || body.range.endDate !== range.endDate) {
        setRange(body.range);
      }
      setDraftRange(body.range);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setSummary(null);
      setEnterprise(undefined);
      setBilling(undefined);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [range.endDate, range.startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpiItems: KpiItem[] = useMemo(() => {
    if (!loaded) {
      return [
        { label: 'Team cycle spend', value: '—', onActivate: cycleTheme },
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
    const chargedCents = billing?.chargedByDay.ok === true ? sumValues(billing.chargedByDay.data.byDay) : null;
    const usageReqs = billing?.dailyByDay.ok === true ? sumValues(billing.dailyByDay.data.usageBasedByDay) : null;
    const usdPerReq = chargedCents != null && usageReqs != null && usageReqs > 0 ? chargedCents / 100 / usageReqs : null;
    const memberCount =
      billing?.spend.ok === true ? billing.spend.data.members.length : summary ? developerCount(summary) : 0;

    return [
      {
        label: 'Team cycle spend',
        value: cycleSpendCents != null ? formatUsdFromCents(cycleSpendCents) : '—',
        onActivate: cycleTheme,
      },
      { label: 'Period', value: `${range.startDate} → ${range.endDate}` },
      {
        label: 'Charged (range)',
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
        label: 'Usage reqs',
        value: usageReqs != null ? usageReqs.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—',
      },
    ];
  }, [loaded, summary, billing, cycleTheme, range.endDate, range.startDate]);

  const toolbarBillingHint = useMemo(() => {
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
  }, [billing]);

  return (
    <main className={styles.root} aria-label="Cursor analytics">
      <div className={styles.layout}>
        <div className={styles.kpiRow}>
          <KpiStrip items={kpiItems} />
        </div>
        <div className={styles.toolbar}>
          <Button
            type="button"
            label="Refresh"
            icon="pi pi-refresh"
            size="small"
            loading={loading}
            onClick={() => void load()}
          />
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
          <CursorAnalyticsDataPanels summary={summary} enterprise={enterprise} billing={billing} range={range} />
        ) : null}
      </div>
    </main>
  );
};
