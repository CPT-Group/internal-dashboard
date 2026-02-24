'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { OpenAndAvgDaysByAssigneeChartData } from '@/types/charts';
import styles from './OpenAndAvgDaysByAssigneeBarLineChart.module.scss';

export interface OpenAndAvgDaysByAssigneeBarLineChartProps {
  data: OpenAndAvgDaysByAssigneeChartData;
}

/**
 * Vertical bar + line: Open count (bars) and Avg days to close (line) per assignee.
 * Presentation only; receives pre-shaped data.
 */
export const OpenAndAvgDaysByAssigneeBarLineChart = ({
  data,
}: OpenAndAvgDaysByAssigneeBarLineChartProps) => {
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

  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Open',
          data: data.open,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line' as const,
          label: 'Avg days to close',
          data: data.avgDays,
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
    }),
    [data]
  );

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
              tooltipItems: { dataIndex: number }[]
            ) {
              const i = tooltipItems[0]?.dataIndex ?? 0;
              const openVal = data.open[i];
              const daysVal = data.avgDays[i];
              return [
                `Open: ${openVal ?? 0}`,
                daysVal != null && Number.isFinite(daysVal)
                  ? `Avg days to close: ${Number(daysVal).toFixed(1)}`
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
  }, [theme, data]);

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
