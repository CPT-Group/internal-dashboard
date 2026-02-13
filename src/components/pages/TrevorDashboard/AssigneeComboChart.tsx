'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import type { NovaAnalytics } from '@/types';
import { TREVOR_TEAM_ORDERED } from '@/constants';
import styles from './AssigneeComboChart.module.scss';

export interface AssigneeComboChartProps {
  analytics: NovaAnalytics;
}

/** Hours per day for avg-days → avg-hours. */
const HOURS_PER_DAY = 24;

/**
 * Radar chart: Open, Closed (done), and Avg hours to close per assignee.
 * Data is across CM, NOVA, OPRD (Trevor JQL already uses project IN (OPRD, CM, NOVA)).
 */
export const AssigneeComboChart = ({ analytics }: AssigneeComboChartProps) => {
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

  const { chartData, rawOpen, rawDone, rawAvgHours, rawAvgDays } = useMemo(() => {
    const byAssigneeMap = new Map(
      analytics.byAssignee.map((a) => [a.assigneeId, a])
    );
    const labels = TREVOR_TEAM_ORDERED.map((m) => m.displayName);
    const assigneeIds = TREVOR_TEAM_ORDERED.map((m) => m.accountId);
    const openData = assigneeIds.map(
      (id) => byAssigneeMap.get(id)?.openCount ?? 0
    );
    const doneData = assigneeIds.map(
      (id) => byAssigneeMap.get(id)?.doneCount ?? 0
    );
    const avgDaysData = assigneeIds.map(
      (id) => byAssigneeMap.get(id)?.avgDaysToClose ?? 0
    );
    const avgHoursData = avgDaysData.map((d) =>
      Math.round(d * HOURS_PER_DAY * 10) / 10
    );

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: 'Open',
            data: openData,
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
            data: doneData,
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
            data: avgHoursData,
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
      },
      rawOpen: openData,
      rawDone: doneData,
      rawAvgHours: avgHoursData,
      rawAvgDays: avgDaysData,
    };
  }, [analytics.byAssignee]);

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
            afterLabel(ctx: { tooltipItem?: { datasetIndex: number; dataIndex: number } }) {
              const ti = ctx.tooltipItem;
              if (ti == null) return '';
              const i = ti.dataIndex;
              if (ti.datasetIndex === 0) return `Open: ${rawOpen[i]}`;
              if (ti.datasetIndex === 1) return `Closed: ${rawDone[i]}`;
              if (ti.datasetIndex === 2 && rawAvgHours[i] != null) {
                const hours = rawAvgHours[i];
                const days = rawAvgDays[i];
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
  }, [theme, rawOpen, rawDone, rawAvgHours, rawAvgDays]);

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
