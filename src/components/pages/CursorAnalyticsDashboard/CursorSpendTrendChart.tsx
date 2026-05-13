'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';

import { formatUsdNumber } from '@/utils/cursorBillingFormat';

import styles from './CursorAnalyticsDashboard.module.scss';

export interface CursorSpendTrendChartProps {
  billingChargedByDay: Record<string, number>;
  /** Shown under legend when usage-events pagination capped the series */
  chargedTruncated?: boolean;
}

interface ChartTheme {
  textColor: string;
  textColorSecondary: string;
  surfaceBorder: string;
  lineChargedUsd: string;
}

function sortedDayKeys(
  a: Record<string, number>,
): string[] {
  const s = new Set<string>([...Object.keys(a)]);
  return [...s].sort();
}

/** Daily team cost trend from Cursor billing events (`chargedCents / 100`). */
export const CursorSpendTrendChart = ({
  billingChargedByDay,
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

  const { labels, chargedUsdSeries } = useMemo(() => {
    const keys = sortedDayKeys(billingChargedByDay);
    const chargedUsdSeriesInner = keys.map((k) => {
      const v = billingChargedByDay[k];
      if (v === undefined || v === 0) return null;
      return v / 100;
    });
    return {
      labels: keys,
      chargedUsdSeries: chargedUsdSeriesInner,
    };
  }, [billingChargedByDay]);

  const hasAnyPoint = useMemo(() => {
    const nz = (arr: (number | null)[]) => arr.some((x) => x != null && x !== 0);
    return nz(chargedUsdSeries);
  }, [chargedUsdSeries]);

  const chartData = useMemo(() => {
    if (!theme) return null;
    const datasets = [
      {
        type: 'line' as const,
        label: 'Team cost',
        data: chargedUsdSeries,
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
  }, [theme, labels, chargedUsdSeries]);

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
            text: 'USD (team charged cost)',
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

  return (
    <div className={styles.trendWrap}>
      <Chart type="line" data={chartData} options={options} className={styles.trendChart} />
      <p className={styles.hint}>
        <strong>Cost source:</strong> values come from Cursor billing usage events (
        <code>chargedCents</code>) converted as <code>cents / 100</code>.
      </p>
      {chargedTruncated ? (
        <p className={styles.hint}>
          Charged series may be incomplete — increase{' '}
          <code>CURSOR_ANALYTICS_USAGE_EVENTS_MAX_PAGES</code> (100 events per page).
        </p>
      ) : null}
    </div>
  );
};
