'use client';

import 'chartjs-adapter-date-fns';
import { useMemo, useEffect, useState } from 'react';
import { Chart } from 'primereact/chart';

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!s || !YYYY_MM_DD.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

interface GanttChartProps {
  tasks: GanttTask[];
  noData?: boolean;
}

/**
 * Dev Team Timeline: horizontal bar chart (Chart.js) with time on X and task labels on Y.
 * Replaces react-frappe-gantt so the timeline actually renders with the same Chart.js stack.
 */
export const GanttChart = ({ tasks, noData }: GanttChartProps) => {
  const [theme, setTheme] = useState<{ textColor: string; gridColor: string } | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setTheme({
      textColor:
        s.getPropertyValue('--text-color').trim() ||
        s.getPropertyValue('--p-text-color').trim() ||
        'rgba(255,255,255,0.9)',
      gridColor:
        s.getPropertyValue('--surface-border').trim() ||
        'rgba(255,255,255,0.12)',
    });
  }, []);

  const validTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t && isValidDateString(t.start) && isValidDateString(t.end)
      ),
    [tasks]
  );

  const chartData = useMemo(() => {
    if (validTasks.length === 0) return null;
    return {
      labels: validTasks.map((t) => t.name),
      datasets: [
        {
          label: 'Timeline',
          data: validTasks.map((t) => [
            new Date(t.start).getTime(),
            new Date(t.end).getTime(),
          ]),
          backgroundColor: 'rgba(36, 205, 197, 0.5)',
          borderColor: 'rgba(36, 205, 197, 0.9)',
          borderWidth: 1,
          barThickness: 32,
          maxBarThickness: 40,
        },
      ],
    };
  }, [validTasks]);

  const chartOptions = useMemo(() => {
    const textColor = theme?.textColor ?? 'rgba(255,255,255,0.9)';
    const gridColor = theme?.gridColor ?? 'rgba(255,255,255,0.12)';
    return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { dataIndex: number }[]) => {
              const i = items[0]?.dataIndex;
              return i != null ? validTasks[i]?.name ?? '' : '';
            },
            label: (ctx: { raw: unknown }) => {
              const r = ctx.raw;
              if (!Array.isArray(r) || r.length < 2) return [];
              const start = typeof r[0] === 'number' ? new Date(r[0]).toLocaleDateString() : String(r[0]);
              const end = typeof r[1] === 'number' ? new Date(r[1]).toLocaleDateString() : String(r[1]);
              return [`Start: ${start}`, `End: ${end}`];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            displayFormats: { day: 'MMM d', week: 'MMM d', month: 'MMM yyyy' },
          },
          ticks: { color: textColor, maxTicksLimit: 8 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: textColor, font: { size: 12 }, maxTicksLimit: 24 },
          grid: { display: false },
        },
      },
    };
  }, [validTasks, theme?.textColor, theme?.gridColor]);

  if (validTasks.length === 0) {
    const message = noData
      ? 'No issues loaded. Timeline will show when Jira returns team issues with created dates.'
      : 'No tasks with valid start/end dates to show on the timeline.';
    return <p className="trevor-gantt-empty-msg">{message}</p>;
  }

  if (!chartData || !chartOptions) return null;

  return (
    <div className="trevor-gantt-chart-wrap">
      <Chart type="bar" data={chartData} options={chartOptions} />
    </div>
  );
};
