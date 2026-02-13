'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import type { JiraIssue } from '@/types';
import { useTrevorJiraStore } from '@/stores';
import { TextScroller } from '@/components/ui';
import { AssigneeComboChart } from './AssigneeComboChart';
import { DistributionChart } from './DistributionChart';
import { ByBoardComponentChart } from './ByBoardComponentChart';
import './TrevorDashboard.module.scss';

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

function isDone(issue: {
  fields?: { status?: { statusCategory?: { key?: string } } };
}): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

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

  const ganttTasks = useMemo(() => {
    const today = toYyyyMmDd(new Date().toISOString());

    function parseDate(value: unknown): string | null {
      if (value == null) return null;
      if (typeof value === 'string') {
        if (value.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      if (typeof value === 'number') {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      }
      return null;
    }

    return allIssues
      .map((issue) => {
        const created = parseDate(issue.fields?.created);
        if (!created) return null;
        const duedateRaw = parseDate(issue.fields?.duedate);
        const duedate = duedateRaw ?? addDays(created, 14);
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
          start: created,
          end,
          progress,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t != null)
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
          <ProgressSpinner className="progress-spinner-sm" />
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
          <Card
            title="Open, closed & avg hours by assignee"
            subTitle="CM, NOVA, OPRD"
            className="trevor-chart-card"
          >
            <AssigneeComboChart analytics={analytics} />
          </Card>
        </div>
        <div className="col-12 md:col-5">
          <Card title="Distribution" className="trevor-chart-card trevor-chart-card-distribution">
            <DistributionChart analytics={analytics} />
          </Card>
        </div>
      </div>

      {Object.keys(analytics.byProject ?? {}).length > 0 && (
        <div className="grid trevor-board-row">
          <div className="col-12">
            <Card title="By board & component" className="trevor-chart-card">
              <ByBoardComponentChart analytics={analytics} />
            </Card>
          </div>
        </div>
      )}

      <Card
        title="Dev Team Timeline"
        className={`trevor-gantt-card ${ganttTasks.length > 0 ? 'flex-1' : 'trevor-gantt-empty'}`}
      >
        <div className="trevor-gantt-wrap">
          <GanttChart tasks={ganttTasks} noData={allIssues.length === 0} />
        </div>
      </Card>

      {loading && (
        <div className="flex align-items-center gap-2 mt-1 flex-shrink-0">
          <ProgressSpinner className="progress-spinner-sm" />
          <span className="text-color-secondary text-xs">Refreshing…</span>
        </div>
      )}
    </div>
  );
};
