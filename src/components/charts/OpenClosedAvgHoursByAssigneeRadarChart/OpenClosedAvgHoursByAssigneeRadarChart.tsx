'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { OpenClosedAvgHoursByAssigneeRadarChartData } from '@/types/charts';
import styles from './OpenClosedAvgHoursByAssigneeRadarChart.module.scss';

export interface OpenClosedAvgHoursByAssigneeRadarChartProps {
  data: OpenClosedAvgHoursByAssigneeRadarChartData;
}

/**
 * Radar chart: Open, Closed, and Avg hours to close per assignee.
 * Presentation only; receives pre-shaped data.
 */
export const OpenClosedAvgHoursByAssigneeRadarChart = ({
  data,
}: OpenClosedAvgHoursByAssigneeRadarChartProps) => {
  const [theme, setTheme] = useState<{
    textColor: string;
    textColorSecondary: string;
    surfaceBorder: string;
  } | null>(null);

  useEffect(() => {
    const documentStyle = getComputedStyle(document.documentElement);
    setTheme({
      textColor:
        documentStyle.getPropertyValue('--text-color').trim() ||
        documentStyle.getPropertyValue('--p-text-color').trim() ||
        'rgba(255,255,255,0.9)',
      textColorSecondary:
        documentStyle.getPropertyValue('--text-color-secondary').trim() ||
        documentStyle.getPropertyValue('--p-text-muted-color').trim() ||
        'rgba(255,255,255,0.6)',
      surfaceBorder:
        documentStyle.getPropertyValue('--surface-border').trim() ||
        'rgba(255,255,255,0.12)',
    });
  }, []);

  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          label: 'Open',
          data: data.open,
          fill: true,
          borderColor: 'rgba(59, 130, 246, 0.9)',
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          pointBackgroundColor: 'rgba(59, 130, 246, 0.9)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 0.9)',
          tension: 0.3,
        },
        {
          label: 'Closed',
          data: data.closed,
          fill: true,
          borderColor: 'rgba(34, 197, 94, 0.9)',
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          pointBackgroundColor: 'rgba(34, 197, 94, 0.9)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(34, 197, 94, 0.9)',
          tension: 0.3,
        },
        {
          label: 'Avg hours to close',
          data: data.avgHours,
          fill: true,
          borderColor: 'rgba(234, 179, 8, 0.9)',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          pointBackgroundColor: 'rgba(234, 179, 8, 0.9)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(234, 179, 8, 0.9)',
          tension: 0.3,
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
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { color: theme.textColor, usePointStyle: true },
        },
        tooltip: {
          enabled: true,
          callbacks: {
            afterLabel(
              tooltipItem: { datasetIndex: number; dataIndex: number }
            ) {
              const i = tooltipItem.dataIndex;
              if (tooltipItem.datasetIndex === 0)
                return `Open: ${data.open[i]}`;
              if (tooltipItem.datasetIndex === 1)
                return `Closed: ${data.closed[i]}`;
              if (tooltipItem.datasetIndex === 2 && data.avgHours[i] != null) {
                const hours = data.avgHours[i];
                const days = data.avgDays[i];
                return days >= 1
                  ? `Avg: ${hours}h (${days.toFixed(1)} days)`
                  : `Avg: ${hours}h`;
              }
              return '';
            },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          pointLabels: {
            color: theme.textColor,
            font: { size: 11 },
          },
          grid: { color: theme.surfaceBorder },
          ticks: {
            color: theme.textColorSecondary,
            backdropColor: 'transparent',
          },
        },
      },
    };
  }, [theme, data]);

  if (!options || !chartData) return null;

  return (
    <div className={styles.wrap}>
      <Chart
        type="radar"
        data={chartData}
        options={options}
        className={styles.chart}
      />
    </div>
  );
};
