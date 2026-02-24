'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { OpenedClosedFlowChartData } from '@/types/charts';
import styles from './OpenedClosedFlowBarChart.module.scss';

export interface OpenedClosedFlowBarChartProps {
  data: OpenedClosedFlowChartData;
}

/**
 * Vertical bar chart: Opened vs Closed per period (e.g. last 14 days).
 * Presentation only; receives pre-shaped data.
 */
export const OpenedClosedFlowBarChart = ({
  data,
}: OpenedClosedFlowBarChartProps) => {
  const [theme, setTheme] = useState<{ text: string; grid: string } | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    setTheme({
      text:
        getComputedStyle(root).getPropertyValue('--text-color').trim() ||
        '#e2e8f0',
      grid:
        getComputedStyle(root).getPropertyValue('--surface-border').trim() ||
        'rgba(255,255,255,0.1)',
    });
  }, []);

  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          label: 'Opened',
          data: data.opened,
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 1,
        },
        {
          label: 'Closed',
          data: data.closed,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
        },
      ],
    }),
    [data]
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
