'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { NovaAnalytics } from '@/types';
import styles from './ByBoardComponentChart.module.scss';

const CHART_COLORS = [
  'rgba(59, 130, 246, 0.82)',
  'rgba(168, 85, 247, 0.82)',
  'rgba(34, 197, 94, 0.82)',
  'rgba(234, 179, 8, 0.82)',
  'rgba(236, 72, 153, 0.82)',
  'rgba(20, 184, 166, 0.82)',
  'rgba(249, 115, 22, 0.82)',
  'rgba(99, 102, 241, 0.82)',
];

export interface ByBoardComponentChartProps {
  analytics: NovaAnalytics;
}

export const ByBoardComponentChart = ({
  analytics,
}: ByBoardComponentChartProps) => {
  const [options, setOptions] = useState<Record<string, unknown> | null>(null);

  const chartData = useMemo(() => {
    const byBoardByComponent = analytics.byBoardByComponent ?? {};
    const byProject = analytics.byProject ?? {};
    const boardKeys = Object.keys(byProject).sort();
    if (boardKeys.length === 0) return { labels: [] as string[], datasets: [] };

    const componentNames = Array.from(
      new Set(
        boardKeys.flatMap((b) => Object.keys(byBoardByComponent[b] ?? {}))
      )
    ).sort();

    const datasets =
      componentNames.length > 0
        ? componentNames.map((compName, i) => ({
            type: 'bar' as const,
            label: compName,
            stack: 'board',
            data: boardKeys.map(
              (b) => byBoardByComponent[b]?.[compName] ?? 0
            ),
            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
            borderColor: CHART_COLORS[i % CHART_COLORS.length].replace(
              '0.82',
              '1'
            ),
            borderWidth: 1,
            borderRadius: 2,
            borderSkipped: false,
          }))
        : [
            {
              type: 'bar' as const,
              label: 'Open',
              stack: 'board',
              data: boardKeys.map((k) => byProject[k]),
              backgroundColor: boardKeys.map(
                (_, i) => CHART_COLORS[i % CHART_COLORS.length]
              ),
              borderColor: boardKeys.map((_, i) =>
                CHART_COLORS[i % CHART_COLORS.length].replace('0.82', '1')
              ),
              borderWidth: 1,
              borderRadius: 4,
              borderSkipped: false,
            },
          ];

    return { labels: boardKeys, datasets };
  }, [analytics.byProject, analytics.byBoardByComponent]);

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor =
      documentStyle.getPropertyValue('--text-color').trim() ||
      documentStyle.getPropertyValue('--p-text-color').trim() ||
      'rgba(255,255,255,0.9)';
    const textColorSecondary =
      documentStyle.getPropertyValue('--text-color-secondary').trim() ||
      documentStyle.getPropertyValue('--p-text-muted-color').trim() ||
      'rgba(255,255,255,0.6)';
    setOptions({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          display: chartData.datasets.length > 1,
          position: 'top' as const,
          labels: { color: textColor, usePointStyle: true },
        },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          beginAtZero: true,
          stacked: true,
          ticks: { color: textColorSecondary },
          title: {
            display: true,
            text: 'Open count (by component)',
            color: textColorSecondary,
          },
          grid: { color: textColorSecondary, drawBorder: false },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: textColor },
        },
      },
    });
  }, [chartData.datasets.length]);

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
