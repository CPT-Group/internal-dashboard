'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';

import { formatUsdNumber } from '@/utils/cursorBillingFormat';

import styles from './CursorAnalyticsDashboard.module.scss';

export type CursorSpendTrendDataSource = 'cycle_usage_share' | 'usage_events';

export interface CursorSpendTrendChartProps {
  /** Daily team cost in USD (already converted from cents where applicable). */
  usdByDay: Record<string, number>;
  /** How `usdByDay` was produced — drives footer copy. */
  dataSource: CursorSpendTrendDataSource;
  /** Shown under legend when usage-events pagination capped the series (only relevant for `usage_events`). */
  chargedTruncated?: boolean;
}

interface ChartTheme {
  textColor: string;
  textColorSecondary: string;
  surfaceBorder: string;
  lineChargedUsd: string;
}

function sortedDayKeys(a: Record<string, number>): string[] {
  const s = new Set<string>([...Object.keys(a)]);
  return [...s].sort();
}

export const CursorSpendTrendChart = ({
  usdByDay,
  dataSource,
  chargedTruncated,
}: CursorSpendTrendChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const st = getComputedStyle(document.documentElement);
    setTheme({
      textColor:
        st.getPropertyValue('--text-color').trim() ||
        st.getPropertyValue('--p-text-color').trim() ||
        'rgba(255,255,255,0.9)',
      textColorSecondary:
        st.getPropertyValue('--text-color-secondary').trim() ||
        st.getPropertyValue('--p-text-muted-color').trim() ||
        'rgba(255,255,255,0.55)',
      surfaceBorder:
        st.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.12)',
      lineChargedUsd: st.getPropertyValue('--chart-warning').trim() || 'rgba(251,191,36,0.95)',
    });
  }, []);

  const { labels, usdSeries } = useMemo(() => {
    const keys = sortedDayKeys(usdByDay);
    const usdSeriesInner = keys.map((k) => {
      const v = usdByDay[k];
      if (v === undefined || v === 0) return null;
      return v;
    });
    return {
      labels: keys,
      usdSeries: usdSeriesInner,
    };
  }, [usdByDay]);

  const hasAnyPoint = useMemo(() => {
    const nz = (arr: (number | null)[]) => arr.some((x) => x != null && x !== 0);
    return nz(usdSeries);
  }, [usdSeries]);

  const chartData = useMemo(() => {
    if (!theme) return null;
    const datasets = [
      {
        type: 'line' as const,
        label: 'Team cost',
        data: usdSeries,
        borderColor: theme.lineChargedUsd,
        backgroundColor: 'transparent',
        borderWidth: 2,
        fill: false,
        tension: 0.2,
        spanGaps: true,
        yAxisID: 'y1',
      },
    ];
    return { labels, datasets };
  }, [theme, labels, usdSeries]);

  const options = useMemo(() => {
    if (!theme) return null;
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { color: theme.textColor, usePointStyle: true },
        },
        tooltip: {
          callbacks: {
            label(ctx: { datasetIndex?: number; parsed: { y: number | null }; dataset?: { label?: string } }) {
              const label = ctx.dataset?.label ?? '';
              const raw = ctx.parsed.y;
              if (raw == null || !Number.isFinite(raw)) return `${label}: —`;
              return `${label}: ${formatUsdNumber(raw)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.surfaceBorder },
          ticks: { color: theme.textColor, maxRotation: 45, font: { size: 10 } },
        },
        y: {
          type: 'linear' as const,
          position: 'right' as const,
          beginAtZero: true,
          title: {
            display: true,
            text: 'USD (team)',
            color: theme.textColorSecondary,
            font: { size: 10 },
          },
          grid: { color: theme.surfaceBorder },
          ticks: {
            color: theme.textColor,
            callback: (value: number | string) => formatUsdNumber(Number(value)),
          },
        },
      },
    };
  }, [theme]);

  if (!hasAnyPoint) {
    return <p className={styles.hint}>No daily cost series in range.</p>;
  }
  if (!chartData || !options) return null;

  const costHint =
    dataSource === 'cycle_usage_share' ? (
      <>
        <strong>Cost source:</strong> team total from Cursor billing <code>/teams/spend</code> (sum of per-member{' '}
        <code>overallSpendCents</code>), split across calendar days by combined usage + included request counts from{' '}
        <code>/teams/daily-usage-data</code>. Daily values sum to the current cycle invoice total over days on or after{' '}
        <code>subscriptionCycleStart</code> in the selected range.
      </>
    ) : (
      <>
        <strong>Cost source:</strong> sum of <code>chargedCents</code> from <code>/teams/filtered-usage-events</code>{' '}
        (÷ 100 for USD). This is metered line-item charges only and can be much smaller than full team subscription
        spend; prefer the spend-shaped series when billing data loads.
      </>
    );

  return (
    <div className={styles.trendWrap}>
      <Chart type="line" data={chartData} options={options} className={styles.trendChart} />
      <p className={styles.hint}>{costHint}</p>
      {dataSource === 'usage_events' && chargedTruncated ? (
        <p className={styles.hint}>
          Event series may be incomplete — increase <code>CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES</code> (100 events per
          page).
        </p>
      ) : null}
    </div>
  );
};
