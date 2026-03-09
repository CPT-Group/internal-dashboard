'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { OpenedClosedFlowChartData } from '@/types/charts';
import styles from './OpenedClosedFlowBarChart.module.scss';

export interface OpenedClosedFlowBarChartProps {
  data: OpenedClosedFlowChartData;
}

interface ChartTheme {
  text: string;
  grid: string;
  success: string;
  successBorder: string;
  danger: string;
  dangerBorder: string;
}

/**
 * Vertical bar chart: Opened vs Closed per period (e.g. last 14 days).
 * Colors read from --chart-success / --chart-danger (theme-aware).
 */
export const OpenedClosedFlowBarChart = ({
  data,
}: OpenedClosedFlowBarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setTheme({
      text: s.getPropertyValue('--text-color').trim() || '#e2e8f0',
      grid: s.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.1)',
      success: s.getPropertyValue('--chart-success').trim() || 'rgba(34,197,94,0.75)',
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      danger: s.getPropertyValue('--chart-danger').trim() || 'rgba(239,68,68,0.75)',
      dangerBorder: s.getPropertyValue('--chart-danger-border').trim() || 'rgb(239,68,68)',
    });
  }, []);

  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          label: 'Opened',
          data: data.opened,
          backgroundColor: theme?.success ?? 'rgba(34,197,94,0.75)',
          borderColor: theme?.successBorder ?? 'rgb(34,197,94)',
          borderWidth: 1,
        },
        {
          label: 'Closed',
          data: data.closed,
          backgroundColor: theme?.danger ?? 'rgba(239,68,68,0.75)',
          borderColor: theme?.dangerBorder ?? 'rgb(239,68,68)',
          borderWidth: 1,
        },
      ],
    }),
    [data, theme]
  );

  const options = useMemo(
    () =>
      theme
        ? {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index' as const, intersect: false },
            plugins: {
              legend: {
                display: true,
                position: 'top' as const,
                labels: { color: theme.text },
              },
            },
            scales: {
              x: {
                grid: { color: theme.grid },
                ticks: { color: theme.text, maxRotation: 45 },
              },
              y: {
                beginAtZero: true,
                grid: { color: theme.grid },
                ticks: { color: theme.text },
              },
            },
          }
        : null,
    [theme]
  );

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
