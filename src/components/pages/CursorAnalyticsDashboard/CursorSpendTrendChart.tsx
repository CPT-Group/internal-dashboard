'use client';

import '@/lib/primeChartJsBootstrap';
import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';

import { formatUsdNumber } from '@/utils/cursorBillingFormat';

import styles from './CursorAnalyticsDashboard.module.scss';

export type CursorSpendTrendDataSource =
  | 'usage_events'
  | 'usage_events_csv_backfill'
  | 'csv_scaled_only'
  | 'csv_model_estimate'
  | 'csv_model_estimate_calibrated'
  /** @deprecated Invoice-shaped curve from `/teams/spend` + daily weights — not default. */
  | 'cycle_usage_share';

export interface CursorSpendTrendChartProps {
  /** Daily team cost in USD (already converted from cents where applicable). */
  usdByDay: Record<string, number>;
  /** How `usdByDay` was produced — drives footer copy. */
  dataSource: CursorSpendTrendDataSource;
  /** Shown under legend when usage-events pagination capped the series (only relevant for `usage_events`). */
  chargedTruncated?: boolean;
  /** Optional second line: e.g. Admin API charged USD per day for comparison to CSV estimate. */
  comparisonUsdByDay?: Record<string, number>;
  /** Legend label for `comparisonUsdByDay` when present. */
  comparisonLabel?: string;
}

interface ChartTheme {
  textColor: string;
  textColorSecondary: string;
  surfaceBorder: string;
  lineChargedUsd: string;
  lineComparisonUsd: string;
}

/** Line dataset for PrimeReact Chart (avoid importing `chart.js` types — keeps bundler from splitting chart with this module). */
interface TrendChartLineDataset {
  type: 'line';
  label: string;
  data: (number | null)[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  borderDash?: number[];
  fill: boolean;
  tension: number;
  spanGaps: boolean;
  yAxisID: string;
}

function sortedDayKeys(a: Record<string, number>): string[] {
  const s = new Set<string>([...Object.keys(a)]);
  return [...s].sort();
}

function mergeSortedDayKeys(primary: Record<string, number>, secondary?: Record<string, number>): string[] {
  const s = new Set<string>([...Object.keys(primary)]);
  if (secondary) {
    for (const k of Object.keys(secondary)) {
      s.add(k);
    }
  }
  return [...s].sort();
}

export const CursorSpendTrendChart = ({
  usdByDay,
  dataSource,
  chargedTruncated,
  comparisonUsdByDay,
  comparisonLabel = 'API (usage events)',
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
      lineComparisonUsd: st.getPropertyValue('--chart-info-border').trim() || 'rgba(59,130,246,0.95)',
    });
  }, []);

  const { labels, usdSeries, comparisonSeries } = useMemo(() => {
    const keys = comparisonUsdByDay ? mergeSortedDayKeys(usdByDay, comparisonUsdByDay) : sortedDayKeys(usdByDay);
    const usdSeriesInner = keys.map((k) => {
      const v = usdByDay[k];
      if (v === undefined || v === 0) return null;
      return v;
    });
    const comparisonSeriesInner = comparisonUsdByDay
      ? keys.map((k) => {
          const v = comparisonUsdByDay[k];
          if (v === undefined || v === 0) return null;
          return v;
        })
      : null;
    return {
      labels: keys,
      usdSeries: usdSeriesInner,
      comparisonSeries: comparisonSeriesInner,
    };
  }, [usdByDay, comparisonUsdByDay]);

  const hasAnyPoint = useMemo(() => {
    const nz = (arr: (number | null)[]) => arr.some((x) => x != null && x !== 0);
    if (nz(usdSeries)) return true;
    if (comparisonSeries && nz(comparisonSeries)) return true;
    return false;
  }, [usdSeries, comparisonSeries]);

  const chartData = useMemo(() => {
    if (!theme) return null;
    const datasets: TrendChartLineDataset[] = [
      {
        type: 'line',
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
    if (comparisonSeries) {
      datasets.push({
        type: 'line',
        label: comparisonLabel,
        data: comparisonSeries,
        borderColor: theme.lineComparisonUsd,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        fill: false,
        tension: 0.2,
        spanGaps: true,
        yAxisID: 'y1',
      });
    }
    return { labels, datasets };
  }, [theme, labels, usdSeries, comparisonSeries, comparisonLabel]);

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
        // Keys must match dataset `yAxisID` — `y` with `y1` data leaves an empty ~0–1 axis and mis-scales the line.
        y1: {
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
        <strong>Cost source (legacy):</strong> team total from Cursor billing <code>/teams/spend</code> (sum of per-member{' '}
        <code>overallSpendCents</code>), split across calendar days by combined usage + included request counts from{' '}
        <code>/teams/daily-usage-data</code>. Earlier days before <code>subscriptionCycleStart</code> stay at zero.
      </>
    ) : dataSource === 'usage_events_csv_backfill' ? (
      <>
        <strong>Cost source:</strong> per-day <code>chargedCents</code> from <code>/teams/filtered-usage-events</code>{' '}
        (÷ 100). Days without event charges but with team CSV daily activity use the same dollars-per-usage ratio
        estimated from days where both event charges and CSV counts exist (or whole-range ratio when needed).
      </>
    ) : dataSource === 'csv_scaled_only' ? (
      <>
        <strong>Cost source:</strong> no per-day event charges in this range — chart uses CSV daily activity scaled by
        the best available dollars-per-usage ratio from the selected window (see team summary <code>byDay</code>).
      </>
    ) : dataSource === 'csv_model_estimate' || dataSource === 'csv_model_estimate_calibrated' ? (
      <>
        <strong>Cost source (estimate):</strong> Analytics CSV has no USD columns — Models Time Series per-model rows ×
        public list $/1M (tokens when present, else requests × assumed tokens/request). When team{' '}
        <strong>Chats Usage Based Requests</strong> for a day
        exceeds the sum of model <code>requests</code> in the JSON, that day is <strong>scaled up</strong> to match the CSV
        usage line. Days with usage but no model row are <strong>imputed</strong> from other days or list defaults.{' '}
        {dataSource === 'csv_model_estimate_calibrated' ? (
          <>
            <strong>Calibration:</strong> daily totals scaled to match Admin API <code>chargedCents</code> on overlap days
            when usage events loaded completely.
          </>
        ) : (
          <>No overlap calibration (load billing via Monetary → API + Refresh to compare).</>
        )}{' '}
        Not invoice-grade — see <code>cursorModelPricingUsdPer1M.ts</code>.
      </>
    ) : (
      <>
        <strong>Cost source:</strong> sum of <code>chargedCents</code> from <code>/teams/filtered-usage-events</code>{' '}
        (÷ 100 for USD) per calendar day.
      </>
    );

  return (
    <div className={styles.trendWrap}>
      <Chart type="line" data={chartData} options={options} className={styles.trendChart} />
      <p className={styles.hint}>{costHint}</p>
      {(dataSource === 'usage_events' ||
        dataSource === 'usage_events_csv_backfill' ||
        dataSource === 'csv_scaled_only') &&
      chargedTruncated ? (
        <p className={styles.hint}>
          <strong>Incomplete event load:</strong> raise <code>CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES_PER_DAY</code>, narrow
          the range, or wait for billing cache. CSV dollar backfill is disabled when events are incomplete.
        </p>
      ) : null}
    </div>
  );
};
