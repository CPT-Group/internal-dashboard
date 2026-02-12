'use client';

import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Skeleton } from 'primereact/skeleton';
import { useJiraNovaStore } from '@/stores';
import { isTrevorTeamMember } from '@/constants';

import '@/styles/frappe-gantt.css';

const GanttChart = dynamic(
  () => import('./GanttChart').then((m) => m.GanttChart),
  { ssr: false, loading: () => <Skeleton width="100%" height="180px" /> }
);

function getAssigneeName(issue: { fields?: { assignee?: { displayName?: string } } }): string {
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

export const TrevorDashboard = () => {
  const { fetchNovaData, isStale, loading, error, getAnalytics, getAllIssues } = useJiraNovaStore();

  useEffect(() => {
    if (isStale()) void fetchNovaData();
    const interval = setInterval(() => {
      if (isStale()) void fetchNovaData();
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNovaData, isStale]);

  const analytics = getAnalytics();
  const allIssues = getAllIssues();

  const teamFiltered = useMemo(() => {
    const filter = (name: string) => isTrevorTeamMember(name);
    const byAssignee = analytics.byAssignee.filter((a) => filter(a.displayName));
    const totalOpen = byAssignee.reduce((s, a) => s + a.openCount, 0);
    const totalToday = byAssignee.reduce((s, a) => s + a.todayCount, 0);
    const totalOverdue = byAssignee.reduce((s, a) => s + a.overdueCount, 0);
    const totalDone = byAssignee.reduce((s, a) => s + a.doneCount, 0);
    return { byAssignee, totalOpen, totalToday, totalOverdue, totalDone };
  }, [analytics.byAssignee]);

  const ganttTasks = useMemo(() => {
    const today = toYyyyMmDd(new Date().toISOString());
    const teamIssues = allIssues.filter((i) => {
      const name = getAssigneeName(i);
      return isTrevorTeamMember(name);
    });

    return teamIssues
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

  if (loading && teamFiltered.totalOpen === 0 && teamFiltered.totalDone === 0) {
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
              <div className="trevor-stat-value text-xl font-bold">{teamFiltered.totalOpen}</div>
              <div className="text-color-secondary text-xs">Open</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">{teamFiltered.totalToday}</div>
              <div className="text-color-secondary text-xs">Today</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">
                {teamFiltered.totalOverdue}
              </div>
              <div className="text-color-secondary text-xs">Late</div>
            </div>
          </Card>
        </div>
        <div className="col-6">
          <Card className="p-2">
            <div className="text-center">
              <div className="trevor-stat-value text-xl font-bold">{teamFiltered.totalDone}</div>
              <div className="text-color-secondary text-xs">Done</div>
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
