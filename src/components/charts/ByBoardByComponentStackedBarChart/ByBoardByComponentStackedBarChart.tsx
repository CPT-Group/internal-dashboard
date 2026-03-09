'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { ByBoardByComponentChartData } from '@/types/charts';
import styles from './ByBoardByComponentStackedBarChart.module.scss';

const CAT_VAR_NAMES = [
  '--chart-cat-1', '--chart-cat-2', '--chart-cat-3', '--chart-cat-4',
  '--chart-cat-5', '--chart-cat-6', '--chart-cat-7', '--chart-cat-8',
] as const;

const CAT_FALLBACKS = [
  'rgba(59,130,246,0.82)', 'rgba(168,85,247,0.82)', 'rgba(34,197,94,0.82)',
  'rgba(234,179,8,0.82)', 'rgba(236,72,153,0.82)', 'rgba(20,184,166,0.82)',
  'rgba(249,115,22,0.82)', 'rgba(99,102,241,0.82)',
];

export interface ByBoardByComponentStackedBarChartProps {
  data: ByBoardByComponentChartData;
}

interface ChartTheme {
  text: string;
  textSecondary: string;
  catColors: string[];
}

/**
 * Stacked horizontal bar: open count by board, with optional breakdown by component.
 * Categorical colors read from --chart-cat-* (theme-aware).
 */
export const ByBoardByComponentStackedBarChart = ({
  data,
}: ByBoardByComponentStackedBarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const text =
      s.getPropertyValue('--text-color').trim() ||
      s.getPropertyValue('--p-text-color').trim() ||
      'rgba(255,255,255,0.9)';
    const textSecondary =
      s.getPropertyValue('--text-color-secondary').trim() ||
      s.getPropertyValue('--p-text-muted-color').trim() ||
      'rgba(255,255,255,0.6)';
    const catColors = CAT_VAR_NAMES.map(
      (v, i) => s.getPropertyValue(v).trim() || CAT_FALLBACKS[i]
    );
    setTheme({ text, textSecondary, catColors });
  }, []);

  const chartData = useMemo(() => {
    if (!theme) return { labels: [] as string[], datasets: [] };
    const { boardKeys, byBoardByComponent, byProject } = data;
    if (boardKeys.length === 0)
      return { labels: [] as string[], datasets: [] };

    const componentNames = Array.from(
      new Set(
        boardKeys.flatMap((b) => Object.keys(byBoardByComponent[b] ?? {}))
      )
    ).sort();

    const toBorder = (c: string) => c.replace(/0\.\d+\)/, '1)');

    const datasets =
      componentNames.length > 0
        ? componentNames.map((compName, i) => {
            const color = theme.catColors[i % theme.catColors.length];
            return {
              type: 'bar' as const,
              label: compName,
              stack: 'board',
              data: boardKeys.map(
                (b) => byBoardByComponent[b]?.[compName] ?? 0
              ),
              backgroundColor: color,
              borderColor: toBorder(color),
              borderWidth: 1,
              borderRadius: 2,
              borderSkipped: false,
            };
          })
        : [
            {
              type: 'bar' as const,
              label: 'Open',
              stack: 'board',
              data: boardKeys.map((k) => byProject[k]),
              backgroundColor: boardKeys.map(
                (_, i) => theme.catColors[i % theme.catColors.length]
              ),
              borderColor: boardKeys.map((_, i) =>
                toBorder(theme.catColors[i % theme.catColors.length])
              ),
              borderWidth: 1,
              borderRadius: 4,
              borderSkipped: false,
            },
          ];

    return { labels: boardKeys, datasets };
  }, [data, theme]);

  const options = useMemo(() => {
    if (!theme) return null;
    return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          display: chartData.datasets.length > 1,
          position: 'top' as const,
          labels: { color: theme.text, usePointStyle: true },
        },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          beginAtZero: true,
          stacked: true,
          ticks: { color: theme.textSecondary },
          title: {
            display: true,
            text: 'Open count (by component)',
            color: theme.textSecondary,
          },
          grid: { color: theme.textSecondary, drawBorder: false },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: theme.text },
        },
      },
    };
  }, [theme, chartData.datasets.length]);

  if (chartData.labels.length === 0 || !options) return null;

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
