'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import type { JiraIssue } from '@/types';
import { useTrevorJiraStore } from '@/stores';

import '@/styles/frappe-gantt.css';

const GanttChart = dynamic(
  () => import('./GanttChart').then((m) => m.GanttChart),
  { ssr: false, loading: () => <Skeleton width="100%" height="180px" /> }
);

function getAssigneeName(issue: JiraIssue): string {
  return issue.fields?.assignee?.displayName ?? 'Unassigned';
}

function toYyyyMmDd(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isDone(issue: { fields?: { status?: { statusCategory?: { key?: string } } } }): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

/* Glossy chart palette: opacity + glow for modern sleek look */
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

export const TrevorDashboard = () => {
  const { fetchTrevorData, isStale, loading, error, getAnalytics, getAllIssues } =
    useTrevorJiraStore();

  useEffect(() => {
    if (isStale()) void fetchTrevorData();
    const interval = setInterval(() => {
      if (isStale()) void fetchTrevorData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrevorData, isStale]);

  const analytics = getAnalytics();
  const allIssues = getAllIssues();

  const barChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const data = analytics.byAssignee.map((a) => a.openCount);
    const colors = analytics.byAssignee.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by assignee',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          hoverBorderWidth: 2,
          hoverShadowBlur: 12,
          hoverShadowOffsetY: 2,
          hoverShadowColor: 'rgba(0,0,0,0.3)',
          hoverBackgroundColor: colors.map((c) => c.replace('0.82', '0.95')),
        },
      ],
    };
  }, [analytics.byAssignee]);

  const barChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      transitions: { active: { animation: { duration: 800 } } },
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    }),
    []
  );

  const doughnutChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const data = analytics.byAssignee.map((a) => a.openCount);
    const colors = analytics.byAssignee.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverShadowBlur: 8,
          hoverShadowOffsetY: 2,
          hoverShadowColor: 'rgba(0,0,0,0.35)',
        },
      ],
    };
  }, [analytics.byAssignee]);

  const doughnutChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1000 },
      transitions: { active: { animation: { duration: 800 } } },
      plugins: {
        legend: {
          position: 'right' as const,
          labels: { boxWidth: 12, padding: 8, usePointStyle: true },
        },
      },
    }),
    []
  );

  const ganttTasks = useMemo(() => {
    const today = toYyyyMmDd(new Date().toISOString());
    return allIssues
      .map((issue) => {
        const start = toYyyyMmDd(issue.fields.created);
        const duedate = issue.fields.duedate
          ? toYyyyMmDd(issue.fields.duedate)
          : addDays(issue.fields.created, 14);
        const end = duedate > today ? duedate : today;
        const progress = isDone(issue) ? 100 : 0;
        const assignee = getAssigneeName(issue);
        const summary =
          issue.fields.summary.length > 40
            ? issue.fields.summary.slice(0, 37) + '...'
            : issue.fields.summary;
        return {
          id: issue.key,
          name: `[${assignee}] ${issue.key}: ${summary}`,
          start,
          end,
          progress,
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [allIssues]);

  if (loading && analytics.totalOpen === 0 && analytics.totalDone === 0) {
    return (
      <div className="trevor-dashboard-content">
        <div className="trevor-stats grid mb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-6">
              <Card className="p-2">
                <div className="flex flex-column align-items-center gap-1">
                  <Skeleton width="2.5rem" height="1.5rem" />
                  <Skeleton width="3rem" height="0.75rem" />
                </div>
              </Card>
            </div>
          ))}
        </div>
        <Card className="p-2 flex-1">
          <Skeleton width="100%" height="160px" />
        </Card>
        <div className="flex align-items-center gap-2 mt-1">
          <ProgressSpinner style={{ width: '16px', height: '16px' }} />
          <span className="text-color-secondary text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trevor-dashboard-content p-2">
        <Message severity="error" text={error} className="w-full" />
      </div>
    );
  }

  return (
    <div className="trevor-dashboard-content">
      <div className="trevor-stats grid mb-2">
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">{analytics.totalOpen}</div>
              <div className="text-color-secondary text-xs">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">{analytics.totalToday}</div>
              <div className="text-color-secondary text-xs">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">
                {analytics.totalOverdue}
              </div>
              <div className="text-color-secondary text-xs">Late</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">{analytics.totalDone}</div>
              <div className="text-color-secondary text-xs">Done</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid mb-2">
        <div className="col-12 md:col-3">
          <Card title="Open by assignee" className="p-2 trevor-chart-card">
            <div style={{ height: '140px' }}>
              <Chart type="bar" data={barChartData} options={barChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-3">
          <Card title="Distribution" className="p-2 trevor-chart-card">
            <div style={{ height: '140px' }}>
              <Chart type="doughnut" data={doughnutChartData} options={doughnutChartOptions} />
            </div>
          </Card>
        </div>
      </div>

      <Card title="Dev Team Timeline" className="p-2 trevor-gantt-card flex-1">
        <div className="trevor-gantt-wrap">
          <GanttChart tasks={ganttTasks} />
        </div>
      </Card>

      {loading && (
        <div className="flex align-items-center gap-2 mt-1 flex-shrink-0">
          <ProgressSpinner style={{ width: '16px', height: '16px' }} />
          <span className="text-color-secondary text-sm">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
