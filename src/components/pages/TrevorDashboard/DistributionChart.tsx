'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { NovaAnalytics } from '@/types';
import { TREVOR_TEAM_ORDERED } from '@/constants';
import styles from './DistributionChart.module.scss';

export interface DistributionChartProps {
  analytics: NovaAnalytics;
}

/**
 * Combo chart: bars = Open per assignee (left axis), line = Avg days to close (right axis).
 * Replaces the donut for a clearer multi-axis view.
 */
export const DistributionChart = ({ analytics }: DistributionChartProps) => {
  const [theme, setTheme] = useState<{
    textColor: string;
    textColorSecondary: string;
    surfaceBorder: string;
  } | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setTheme({
      textColor:
        s.getPropertyValue('--text-color').trim() ||
        s.getPropertyValue('--p-text-color').trim() ||
        'rgba(255,255,255,0.9)',
      textColorSecondary:
        s.getPropertyValue('--text-color-secondary').trim() ||
        s.getPropertyValue('--p-text-muted-color').trim() ||
        'rgba(255,255,255,0.6)',
      surfaceBorder:
        s.getPropertyValue('--surface-border').trim() ||
        'rgba(255,255,255,0.12)',
    });
  }, []);

  const { chartData, openData, avgDaysData } = useMemo(() => {
    const byMap = new Map(analytics.byAssignee.map((a) => [a.assigneeId, a]));
    const labels = TREVOR_TEAM_ORDERED.map((m) => m.displayName);
    const assigneeIds = TREVOR_TEAM_ORDERED.map((m) => m.accountId);
    const open = assigneeIds.map((id) => byMap.get(id)?.openCount ?? 0);
    const avgDays = assigneeIds.map(
      (id) => byMap.get(id)?.avgDaysToClose ?? 0
    );
    return {
      chartData: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Open',
            data: open,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            yAxisID: 'y',
            order: 2,
          },
          {
            type: 'line' as const,
            label: 'Avg days to close',
            data: avgDays,
            borderColor: 'rgba(234, 179, 8, 0.95)',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.2,
            pointBackgroundColor: 'rgba(234, 179, 8, 0.95)',
            pointBorderColor: '#fff',
            pointBorderWidth: 1,
            yAxisID: 'y1',
            order: 1,
          },
        ],
      },
      openData: open,
      avgDaysData: avgDays,
    };
  }, [analytics.byAssignee]);

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
          labels: {
            color: theme.textColor,
            usePointStyle: true,
            pointStyle: (ctx: { datasetIndex: number }) =>
              ctx.datasetIndex === 0 ? 'rect' : 'line',
          },
        },
        tooltip: {
          callbacks: {
            afterBody(
              _: unknown,
              items: { datasetIndex: number; dataIndex: number }[] | undefined
            ) {
              const i = items?.[0]?.dataIndex ?? 0;
              const openArr = openData ?? [];
              const daysArr = avgDaysData ?? [];
              const open = openArr[i];
              const days = daysArr[i];
              return [
                `Open: ${open ?? 0}`,
                days != null && Number.isFinite(days)
                  ? `Avg days to close: ${Number(days).toFixed(1)}`
                  : '',
              ].filter(Boolean);
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: theme.surfaceBorder },
          ticks: {
            color: theme.textColor,
            maxRotation: 25,
            font: { size: 10 },
          },
        },
        y: {
          type: 'linear' as const,
          position: 'left' as const,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Open',
            color: theme.textColorSecondary,
            font: { size: 10 },
          },
          grid: { color: theme.surfaceBorder },
          ticks: { color: theme.textColor },
        },
        y1: {
          type: 'linear' as const,
          position: 'right' as const,
          beginAtZero: true,
          title: {
            display: true,
            text: 'Avg days',
            color: theme.textColorSecondary,
            font: { size: 10 },
          },
          grid: { drawOnChartArea: false },
          ticks: { color: theme.textColor },
        },
      },
    };
  }, [
    theme,
    openData,
    avgDaysData,
  ]);

  if (!options) return null;

  return (
    <div className={styles.wrap}>
      <Chart
        type="bar"
        data={chartData}
        options={options}
        className={styles.chart}
      />
    </div>
  );
};
