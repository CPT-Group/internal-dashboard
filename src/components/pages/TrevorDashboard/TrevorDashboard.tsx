'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import type { InProgressTicket } from '@/types';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { ByBoardByComponentStackedBarChart, HorizontalBarChart } from '@/components/charts';
import { toByBoardByComponentChartData } from '@/utils/chartDataMappers';
import type { HorizontalBarChartData } from '@/types/charts';
import { NOVA_TEAM_ORDERED, NOVA_CORE_DEVS } from '@/constants';
import { useAutoScroll, useWorkHoursToday } from '@/hooks';
import styles from './TrevorDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

const STATUS_ORDER = ['To Do', 'Data Team New', 'Requested', 'In Progress', 'Data Team In Progress',
  'Development', 'DEVELOPMENT', 'Dev Review', 'Peer Testing', 'PEER TESTING',
  'Data Team Testing', 'QA', 'QA/QC'];

function statusSeverity(status: string): 'info' | 'success' | 'warning' | 'danger' | undefined {
  const s = status.toLowerCase();
  if (s.includes('progress') || s === 'development') return 'info';
  if (s.includes('review') || s.includes('testing') || s === 'qa' || s === 'qa/qc' || s === 'peer testing') return 'warning';
  if (s.includes('to do') || s.includes('new') || s === 'requested') return undefined;
  return undefined;
}

const summaryBody = (row: InProgressTicket) =>
  row.summary.length > 55 ? row.summary.slice(0, 52) + '…' : row.summary;

const statusBody = (row: InProgressTicket) => (
  <Tag value={row.status} severity={statusSeverity(row.status)} />
);

const componentBody = (row: InProgressTicket) =>
  row.component.length > 18 ? row.component.slice(0, 16) + '…' : row.component;

export const TrevorDashboard = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } =
    useOperationalJiraStore();

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOperationalData, isStale]);

  const analytics = getAnalytics();
  const { kpis, inProgressTickets, requestedTickets, teamActivity } = analytics;

  const byBoardChartData = useMemo(
    () => toByBoardByComponentChartData(analytics),
    [analytics]
  );

  const teamLoadData: HorizontalBarChartData = useMemo(() => {
    const members = NOVA_TEAM_ORDERED.map((m) => {
      const ta = teamActivity.find((t) => t.accountId === m.accountId);
      return { name: m.displayName.split(' ')[0], count: ta?.openCount ?? 0 };
    }).sort((a, b) => b.count - a.count);

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.count),
    };
  }, [teamActivity]);

  const novaActive = useMemo(() => {
    const allActive = [...inProgressTickets, ...requestedTickets];
    return allActive
      .filter((t) => t.project === 'NOVA')
      .sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status);
        const bi = STATUS_ORDER.indexOf(b.status);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [inProgressTickets, requestedTickets]);

  const novaInProgress = novaActive.filter((t) => {
    const s = t.status.toLowerCase();
    return s.includes('progress') || s === 'development';
  }).length;

  const novaReview = novaActive.filter((t) => {
    const s = t.status.toLowerCase();
    return s.includes('review') || s.includes('testing') || s === 'qa' || s === 'qa/qc';
  }).length;

  const novaToDo = novaActive.filter((t) => {
    const s = t.status.toLowerCase();
    return s.includes('to do') || s.includes('new') || s === 'requested';
  }).length;

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'NOVA Active', value: novaActive.length },
    { label: 'In Progress', value: novaInProgress },
    { label: 'To Do', value: novaToDo },
    { label: 'Review / QA', value: novaReview },
    { label: 'Total Open', value: kpis.openCount },
  ], [novaActive.length, novaInProgress, novaToDo, novaReview, kpis.openCount]);

  const { hours: workHours } = useWorkHoursToday();

  const [hourThemeColors, setHourThemeColors] = useState<{
    success: string; warning: string; orange: string; danger: string;
  } | null>(null);

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    setHourThemeColors({
      success: s.getPropertyValue('--chart-success-border').trim() || 'rgb(34,197,94)',
      warning: s.getPropertyValue('--chart-warning-border').trim() || 'rgb(234,179,8)',
      orange: s.getPropertyValue('--chart-orange-border').trim() || 'rgb(249,115,22)',
      danger: s.getPropertyValue('--chart-danger-border').trim() || 'rgb(239,68,68)',
    });
  }, []);

  const workHoursData: HorizontalBarChartData = useMemo(() => {
    const members = NOVA_CORE_DEVS.map((m) => ({
      name: m.displayName.split(' ')[0],
      hours: Math.round(((workHours.get(m.accountId) ?? 0) / 3600) * 10) / 10,
    })).sort((a, b) => b.hours - a.hours);

    const getBorderColor = (h: number) => {
      if (!hourThemeColors) return undefined;
      if (h < 4) return hourThemeColors.danger;
      if (h < 6) return hourThemeColors.warning;
      if (h <= 7) return hourThemeColors.success;
      if (h <= 8) return hourThemeColors.warning;
      if (h <= 9) return hourThemeColors.orange;
      return hourThemeColors.danger;
    };

    const borderColors = hourThemeColors
      ? members.map((m) => getBorderColor(m.hours)!)
      : undefined;
    const flashIndices = members
      .map((m, i) => (m.hours > 0 && (m.hours < 4 || m.hours > 8) ? i : -1))
      .filter((i) => i >= 0);

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
      borderColors,
      suffix: 'h',
      flashIndices: flashIndices.length > 0 ? flashIndices : undefined,
    };
  }, [workHours, hourThemeColors]);

  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingWrap}><ProgressSpinner /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <Message severity="error" text={error} className="w-full" />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.kpiRow}>
        <KpiStrip items={kpiItems} />
      </div>

      <div className={styles.mainContent}>
        <div className={styles.chartCol}>
          <Card className={styles.chartCard}>
            <div className={styles.panelHeader}>By Board &amp; Component</div>
            <ByBoardByComponentStackedBarChart data={byBoardChartData} />
          </Card>
          <Card className={styles.chartCard}>
            <div className={styles.panelHeader}>NOVA Team Load</div>
            <HorizontalBarChart data={teamLoadData} />
          </Card>
          <Card className={styles.chartCard}>
            <div className={styles.panelHeader}>Work Hours Today</div>
            <HorizontalBarChart data={workHoursData} />
          </Card>
        </div>

        <div className={styles.tableCol}>
          <Card className={styles.tableCard}>
            <div className={styles.panelHeader}>
              NOVA Tickets
              <Tag value={`${novaActive.length}`} severity="info" className="ml-2" />
            </div>
            <div ref={scrollRef} className={styles.tableScrollWrap}>
              <DataTable
                value={novaActive}
                size="small"
                stripedRows
                showGridlines
                emptyMessage="No active NOVA tickets"
              >
                <Column field="key" header="Key" style={{ width: '80px' }} />
                <Column field="summary" header="Summary" body={summaryBody} />
                <Column field="assignee" header="Assignee" style={{ width: '100px' }} />
                <Column field="status" header="Status" body={statusBody} style={{ width: '100px' }} />
                <Column field="component" header="Component" body={componentBody} style={{ width: '110px' }} />
              </DataTable>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
