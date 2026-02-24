'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { HorizontalBarChartData } from '@/types/charts';
import styles from './HorizontalBarChart.module.scss';

export interface HorizontalBarChartProps {
  data: HorizontalBarChartData;
}

/**
 * Horizontal bar chart: one bar per label with optional per-bar colors.
 * Used for backlog by component, aging buckets, etc.
 * Presentation only; receives pre-shaped data.
 */
export const HorizontalBarChart = ({ data }: HorizontalBarChartProps) => {
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
          label: data.labels.length ? 'Count' : '',
          data: data.values,
          backgroundColor:
            data.colors && data.colors.length === data.values.length
              ? data.colors
              : 'rgba(59, 130, 246, 0.7)',
          borderColor:
            data.colors && data.colors.length === data.values.length
              ? data.colors.map((c) => c.replace('0.7', '1').replace('0.8', '1'))
              : 'rgb(59, 130, 246)',
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
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: theme.grid },
                ticks: { color: theme.text },
              },
              y: {
                grid: { display: false },
                ticks: { color: theme.text },
              },
            },
          }
        : null,
    [theme]
  );

  if (!options || data.labels.length === 0) return null;

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
