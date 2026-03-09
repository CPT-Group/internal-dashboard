'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { HorizontalBarChartData } from '@/types/charts';
import styles from './HorizontalBarChart.module.scss';

export interface HorizontalBarChartProps {
  data: HorizontalBarChartData;
}

interface ChartTheme {
  text: string;
  grid: string;
  barPrimary: string;
  barPrimaryBorder: string;
  labelColor: string;
}

/**
 * Horizontal bar chart: one bar per label with optional per-bar colors.
 * Default bar color reads from --chart-bar-primary (theme-aware).
 * Shows data labels on each bar for exact values.
 */
export const HorizontalBarChart = ({ data }: HorizontalBarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const s = getComputedStyle(root);
    setTheme({
      text: s.getPropertyValue('--text-color').trim() || '#e2e8f0',
      grid: s.getPropertyValue('--surface-border').trim() || 'rgba(255,255,255,0.1)',
      barPrimary: s.getPropertyValue('--chart-bar-primary').trim() || 'rgba(36,205,197,0.82)',
      barPrimaryBorder: s.getPropertyValue('--chart-bar-primary-border').trim() || 'rgb(36,205,197)',
      labelColor: s.getPropertyValue('--chart-label-color').trim() || '#ffffff',
    });
  }, []);

  const chartData = useMemo(() => {
    const hasCustomColors = data.colors && data.colors.length === data.values.length;
    return {
      labels: data.labels,
      datasets: [
        {
          label: data.labels.length ? 'Count' : '',
          data: data.values,
          backgroundColor: hasCustomColors ? data.colors : theme?.barPrimary ?? 'rgba(36,205,197,0.82)',
          borderColor: hasCustomColors
            ? data.colors!.map((c) => c.replace(/0\.\d+\)/, '1)'))
            : theme?.barPrimaryBorder ?? 'rgb(36,205,197)',
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    };
  }, [data, theme]);

  const options = useMemo(
    () =>
      theme
        ? {
            indexAxis: 'y' as const,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              datalabels: {
                display: (ctx: { dataset: { data: number[] }; dataIndex: number }) =>
                  (ctx.dataset.data[ctx.dataIndex] ?? 0) > 0,
                anchor: 'end' as const,
                align: 'start' as const,
                offset: 4,
                color: theme.labelColor,
                font: { weight: 'bold' as const, size: 12 },
                formatter: (value: number) => (value > 0 ? value : ''),
              },
            },
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
        plugins={[ChartDataLabels]}
        className={styles.chart}
      />
    </div>
  );
};
