'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from 'primereact/card';
import { Chart } from 'primereact/chart';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import type { JiraIssue } from '@/types';
import { useTrevorJiraStore } from '@/stores';
import { JiraMeterChart, TextScroller } from '@/components/ui';

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

function useThemeChartColors(): { text: string; muted: string } {
  const [colors, setColors] = useState({ text: 'rgba(255,255,255,0.9)', muted: 'rgba(255,255,255,0.6)' });
  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const text = (style.getPropertyValue('--text-color').trim() || style.getPropertyValue('--p-text-color').trim()) || 'rgba(255,255,255,0.9)';
    const muted = (style.getPropertyValue('--text-color-secondary').trim() || style.getPropertyValue('--p-text-muted-color').trim()) || 'rgba(255,255,255,0.6)';
    setColors({ text, muted });
  }, []);
  return colors;
}

export const TrevorDashboard = () => {
  const { fetchTrevorData, isStale, loading, error, getAnalytics, getAllIssues } =
    useTrevorJiraStore();
  const themeColors = useThemeChartColors();

  useEffect(() => {
    if (isStale()) void fetchTrevorData();
    const interval = setInterval(() => {
      if (isStale()) void fetchTrevorData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrevorData, isStale]);

  const analytics = getAnalytics();
  const allIssues = getAllIssues();

  /* Combo: Open (bars, bottom axis) + Avg days to close (line, top axis) – one chart, two dimensions */
  const assigneeComboChartData = useMemo(() => {
    const labels = analytics.byAssignee.map((a) => a.displayName);
    const openData = analytics.byAssignee.map((a) => a.openCount);
    const avgDaysData = analytics.byAssignee.map((a) => a.avgDaysToClose ?? 0);
    const colors = analytics.byAssignee.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Open',
          data: openData,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line' as const,
          label: 'Avg days to close',
          data: avgDaysData,
          borderColor: 'rgba(234, 179, 8, 0.95)',
          backgroundColor: 'rgba(234, 179, 8, 0.15)',
          fill: false,
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: 'rgba(234, 179, 8, 0.95)',
          xAxisID: 'x1',
          order: 1,
        },
      ],
    };
  }, [analytics.byAssignee]);

  const assigneeComboChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: themeColors.text,
            usePointStyle: true,
          },
        },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          beginAtZero: true,
          position: 'bottom' as const,
          title: { display: true, text: 'Open count', color: themeColors.muted },
          ticks: { color: themeColors.muted },
          grid: { color: themeColors.muted, drawBorder: false },
        },
        x1: {
          beginAtZero: true,
          position: 'top' as const,
          title: { display: true, text: 'Avg days to close', color: themeColors.muted },
          ticks: { color: themeColors.muted },
          grid: { drawOnChartArea: false },
          suggestedMax: 15,
        },
        y: {
          grid: { display: false },
          ticks: { color: themeColors.text },
        },
      },
    }),
    [themeColors.text, themeColors.muted]
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
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: themeColors.muted },
          title: { display: true, text: 'Open count', color: themeColors.muted },
          grid: { color: themeColors.muted, drawBorder: false },
        },
        y: {
          grid: { display: false },
          ticks: { color: themeColors.text },
        },
      },
    }),
    [themeColors.text, themeColors.muted]
  );

  const byComponentChartData = useMemo(() => {
    const byComponent = analytics.byComponent ?? {};
    const labels = Object.keys(byComponent).sort();
    const data = labels.map((k) => byComponent[k]);
    const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    return {
      labels,
      datasets: [
        {
          label: 'Open by component',
          data,
          backgroundColor: colors,
          borderColor: colors.map((c) => c.replace('0.82', '1')),
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [analytics.byComponent]);

  const byComponentChartOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: themeColors.muted },
          title: { display: true, text: 'Open count', color: themeColors.muted },
          grid: { color: themeColors.muted, drawBorder: false },
        },
        y: {
          grid: { display: false },
          ticks: { color: themeColors.text },
        },
      },
    }),
    [themeColors.text, themeColors.muted]
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
        <div className="trevor-stats-strip">
          <div className="trevor-stats-strip-inner">
            <Skeleton width="100%" height="1.5rem" />
          </div>
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

  const statsScrollerContent = (
    <>
      <span className="trevor-stat-item">
        <i className="pi pi-inbox" aria-hidden />
        <strong>{analytics.totalOpen}</strong> Open
      </span>
      <span className="trevor-stat-sep" aria-hidden> · </span>
      <span className="trevor-stat-item">
        <i className="pi pi-calendar" aria-hidden />
        <strong>{analytics.totalToday}</strong> Today
      </span>
      <span className="trevor-stat-sep" aria-hidden> · </span>
      <span className="trevor-stat-item trevor-stat-late">
        <i className="pi pi-exclamation-triangle" aria-hidden />
        <strong>{analytics.totalOverdue}</strong> Late
      </span>
      <span className="trevor-stat-sep" aria-hidden> · </span>
      <span className="trevor-stat-item trevor-stat-done">
        <i className="pi pi-check-circle" aria-hidden />
        <strong>{analytics.totalDone}</strong> Done
      </span>
    </>
  );

  return (
    <div className="trevor-dashboard-content">
      <div className="trevor-stats-strip">
        <TextScroller className="trevor-stats-scroller" duration={22}>
          {statsScrollerContent}
        </TextScroller>
      </div>

      <div className="grid trevor-charts-row">
        <div className="col-12 md:col-7">
          <Card title="Open & avg days by assignee" className="trevor-chart-card">
            <div className="trevor-chart-inner" style={{ minHeight: '180px' }}>
              <Chart type="bar" data={assigneeComboChartData} options={assigneeComboChartOptions} />
            </div>
          </Card>
        </div>
        <div className="col-12 md:col-5">
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

      <div className="grid mt-2">
        {analytics.byComponent != null && Object.keys(analytics.byComponent).length > 0 && (
          <div className="col-12 md:col-6">
            <Card title="By component" className="trevor-chart-card">
              <div className="trevor-chart-inner">
                <Chart
                  type="bar"
                  data={byComponentChartData}
                  options={byComponentChartOptions}
                />
              </div>
            </Card>
          </div>
        )}
        {analytics.byProject != null && Object.keys(analytics.byProject).length > 0 && (
          <div className="col-12 md:col-6">
            <Card title="By board" className="trevor-chart-card">
              <div className="trevor-chart-inner" style={{ height: '140px' }}>
                <Chart
                  type="bar"
                  data={byProjectChartData}
                  options={byProjectChartOptions}
                />
              </div>
            </Card>
          </div>
        )}
      </div>

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
