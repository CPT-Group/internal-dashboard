'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { OpenClosedAvgHoursByAssigneeRadarChartData } from '@/types/charts';
import styles from './OpenClosedAvgHoursByAssigneeRadarChart.module.scss';

export interface OpenClosedAvgHoursByAssigneeRadarChartProps {
  data: OpenClosedAvgHoursByAssigneeRadarChartData;
}

interface ChartTheme {
  textColor: string;
  textColorSecondary: string;
  surfaceBorder: string;
  info: string;
  infoBorder: string;
  success: string;
  successBorder: string;
  warning: string;
  warningBorder: string;
}

/**
 * Radar chart: Open, Closed, and Avg hours to close per assignee.
 * Colors from --chart-info (open), --chart-success (closed), --chart-warning (avg).
 */
export const OpenClosedAvgHoursByAssigneeRadarChart = ({
  data,
}: OpenClosedAvgHoursByAssigneeRadarChartProps) => {
  const [theme, setTheme] = useState<ChartTheme | null>(null);

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
      info: s.getPropertyValue('--chart-info').trim() || 'rgba(59,130,246,0.75)',
      infoBorder: s.getPropertyValue('--chart-info-border').trim() || 'rgb(59,130,246)',
      success: s.getPropertyValue('--chart-success').trim() || 'rgba(34,197,94,0.75)',
      successBorder: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warning: s.getPropertyValue('--chart-warning').trim() || 'rgba(234,179,8,0.9)',
      warningBorder: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
    });
  }, []);

  const toFill = (solid: string) => solid.replace(/0\.\d+\)/, '0.2)');

  const chartData = useMemo(
    () => ({
      labels: data.labels,
      datasets: [
        {
          label: 'Open',
          data: data.open,
          fill: true,
          borderColor: theme?.infoBorder ?? 'rgb(59,130,246)',
          backgroundColor: toFill(theme?.info ?? 'rgba(59,130,246,0.75)'),
          pointBackgroundColor: theme?.infoBorder ?? 'rgb(59,130,246)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: theme?.infoBorder ?? 'rgb(59,130,246)',
          tension: 0.3,
        },
        {
          label: 'Closed',
          data: data.closed,
          fill: true,
          borderColor: theme?.successBorder ?? 'rgb(34,197,94)',
          backgroundColor: toFill(theme?.success ?? 'rgba(34,197,94,0.75)'),
          pointBackgroundColor: theme?.successBorder ?? 'rgb(34,197,94)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: theme?.successBorder ?? 'rgb(34,197,94)',
          tension: 0.3,
        },
        {
          label: 'Avg hours to close',
          data: data.avgHours,
          fill: true,
          borderColor: theme?.warningBorder ?? 'rgb(234,179,8)',
          backgroundColor: (theme?.warning ?? 'rgba(234,179,8,0.9)').replace(/0\.\d+\)/, '0.15)'),
          pointBackgroundColor: theme?.warningBorder ?? 'rgb(234,179,8)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: theme?.warningBorder ?? 'rgb(234,179,8)',
          tension: 0.3,
        },
      ],
    }),
    [data, theme]
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
            afterLabel(tooltipItem: { datasetIndex: number; dataIndex: number }) {
              const i = tooltipItem.dataIndex;
              if (tooltipItem.datasetIndex === 0) return `Open: ${data.open[i]}`;
              if (tooltipItem.datasetIndex === 1) return `Closed: ${data.closed[i]}`;
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
          pointLabels: { color: theme.textColor, font: { size: 11 } },
          grid: { color: theme.surfaceBorder },
          ticks: { color: theme.textColorSecondary, backdropColor: 'transparent' },
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
