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
import { JiraMeterChart } from '@/components/ui';

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
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byAssignee]);

  const barChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    }),
    []
  );

  const byProjectChartData = useMemo(() => {
    const byProject = analytics.byProject ?? {};
    const labels = Object.keys(byProject).sort();
    const data = labels.map((k) => byProject[k]);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by board',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byProject]);

  const byProjectChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    }),
    []
  );

  const ganttTasks = useMemo(() => {
    const today = toYyyyMmDd(new Date().toISOString());
    return allIssues
      .filter((issue) => issue.fields?.created != null && String(issue.fields.created).length >= 10)
      .map((issue) => {
        const created = String(issue.fields.created).slice(0, 10);
        const start = created;
        const duedate = issue.fields?.duedate != null && String(issue.fields.duedate).length >= 10
          ? String(issue.fields.duedate).slice(0, 10)
          : addDays(created, 14);
        const end = duedate > today ? duedate : today;
        const progress = isDone(issue) ? 100 : 0;
        const assignee = getAssigneeName(issue);
        const summary =
          (issue.fields?.summary ?? '').length > 40
            ? (issue.fields.summary as string).slice(0, 37) + '...'
            : (issue.fields?.summary ?? issue.key);
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
        <div className="trevor-stats grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-6 col-md-3">
              <Card className="trevor-stat-card">
                <div className="flex flex-column align-items-center gap-1">
                  <Skeleton width="2rem" height="1.25rem" />
                  <Skeleton width="2.5rem" height="0.65rem" />
                </div>
              </Card>
            </div>
          ))}
        </div>
        <Card className="trevor-gantt-card flex-1">
          <Skeleton width="100%" height="140px" />
        </Card>
        <div className="flex align-items-center gap-2 mt-1">
          <ProgressSpinner style={{ width: '14px', height: '14px' }} />
          <span className="text-color-secondary text-xs">Loading…</span>
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
      <div className="trevor-stats grid">
        <div className="col-6 col-md-3">
          <Card className="trevor-stat-card">
            <div className="text-center">
              <div className="trevor-stat-value font-bold">{analytics.totalOpen}</div>
              <div className="text-color-secondary text-xs">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="trevor-stat-card">
            <div className="text-center">
              <div className="trevor-stat-value font-bold">{analytics.totalToday}</div>
              <div className="text-color-secondary text-xs">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="trevor-stat-card">
            <div className="text-center">
              <div className="trevor-stat-value font-bold">{analytics.totalOverdue}</div>
              <div className="text-color-secondary text-xs">Late</div>
            </div>
          </Card>
        </div>
        <div className="col-6 col-md-3">
          <Card className="trevor-stat-card">
            <div className="text-center">
              <div className="trevor-stat-value font-bold">{analytics.totalDone}</div>
              <div className="text-color-secondary text-xs">Done</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid trevor-charts-row">
        <div className="col-12 md:col-6">
          <Card title="Open by assignee" className="trevor-chart-card">
            <div className="trevor-chart-inner">
              <Chart type="bar" data={barChartData} options={barChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-6">
          <Card title="Distribution" className="trevor-chart-card">
            <div className="trevor-chart-inner" style={{ minHeight: '200px' }}>
              <JiraMeterChart
                centerValue={analytics.totalOpen}
                centerLabel="Open"
                labels={analytics.byAssignee.map((a) => a.displayName)}
                data={analytics.byAssignee.map((a) => a.openCount)}
                colors={CHART_COLORS}
                height={200}
              />
            </div>
          </Card>
        </div>
      </div>

      {analytics.byProject != null && Object.keys(analytics.byProject).length > 0 && (
        <div className="grid mt-2">
          <div className="col-12">
            <Card title="By board" className="trevor-chart-card">
              <div className="trevor-chart-inner" style={{ height: '160px' }}>
                <Chart
                  type="bar"
                  data={byProjectChartData}
                  options={byProjectChartOptions}
                />
              </div>
            </Card>
          </div>
        </div>
      )}

      <Card title="Dev Team Timeline" className="trevor-gantt-card flex-1">
        <div className="trevor-gantt-wrap">
          <GanttChart tasks={ganttTasks} />
        </div>
      </Card>

      {loading && (
        <div className="flex align-items-center gap-2 mt-1 flex-shrink-0">
          <ProgressSpinner style={{ width: '14px', height: '14px' }} />
          <span className="text-color-secondary text-xs">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
