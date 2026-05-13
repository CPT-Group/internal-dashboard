'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import type { InProgressTicket } from '@/types';
import { LOADING_NOVA_DATA_PLEASE_WAIT } from '@/constants';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { ByBoardByComponentStackedBarChart, HorizontalBarChart } from '@/components/charts';
import { toByBoardByComponentChartData } from '@/utils/chartDataMappers';
import type { HorizontalBarChartData } from '@/types/charts';
import { NOVA_TEAM_ORDERED, NOVA_CORE_DEVS } from '@/constants';
import { useAutoScroll, useWorkHoursToday } from '@/hooks';
import { useTheme } from '@/providers/ThemeProvider';
import {
  getCurrentTargetHours,
  getWorkHoursBarBorder,
  getWorkHoursBarFill,
  getWorkHoursFlashLevel,
  getWorkHoursZone,
} from '@/utils/workHoursRollingTarget';
import type { WorkHoursChartTheme } from '@/utils/workHoursRollingTarget';
import styles from './TrevorDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;
const SHOW_BY_BOARD_AND_COMPONENT = false;

const STATUS_ORDER = ['To Do', 'Data Team New', 'Requested', 'In Dev', 'In Progress', 'Data Team In Progress',
  'Development', 'DEVELOPMENT', 'Dev Review', 'Peer Testing', 'PEER TESTING',
  'Data Team Testing', 'QA', 'QA/QC'];

function statusSeverity(status: string): 'info' | 'success' | 'warning' | 'danger' | undefined {
  const s = status.toLowerCase();
  if (s.includes('progress') || s === 'development' || s === 'in dev') return 'info';
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

const formatHoursDecimal = (seconds: number): number =>
  Math.round((seconds / 3600) * 100) / 100;

interface TrevorHourThemeColors extends WorkHoursChartTheme {
  markerColor: string;
}

export const TrevorDashboard = () => {
  const { theme } = useTheme();
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
    return s.includes('progress') || s === 'development' || s === 'in dev';
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

  const [hourThemeColors, setHourThemeColors] = useState<TrevorHourThemeColors | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const s = getComputedStyle(document.documentElement);
    const readToken = (name: string, fallback: string): string => {
      const value = s.getPropertyValue(name).trim();
      return value || fallback;
    };
    setHourThemeColors({
      successFill: readToken('--work-hours-success-fill', 'rgba(34,197,94,0.35)'),
      warningFill: readToken('--work-hours-warning-fill', 'rgba(234,179,8,0.35)'),
      superFill: readToken('--work-hours-super-fill', 'rgba(34,211,238,0.45)'),
      dangerFill: readToken('--work-hours-danger-fill', 'rgba(239,68,68,0.78)'),
      neutralFill: readToken('--work-hours-neutral-fill', 'rgba(36,205,197,0.35)'),
      successBorder: readToken('--chart-success-border', 'rgb(34,197,94)'),
      warningBorder: readToken('--chart-warning-border', 'rgb(234,179,8)'),
      superBorder: readToken('--work-hours-super-border', 'rgb(34,211,238)'),
      dangerBorder: readToken('--chart-danger-border', 'rgb(239,68,68)'),
      markerColor: readToken('--work-hours-target-line-color', readToken('--primary-color', 'rgb(36,205,197)')),
    });
  }, [theme]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const targetHours = useMemo(() => getCurrentTargetHours(now), [now]);

  const workHoursData: HorizontalBarChartData = useMemo(() => {
    const members = NOVA_CORE_DEVS.map((m) => ({
      name: m.displayName.split(' ')[0],
      hours: formatHoursDecimal(workHours.get(m.accountId) ?? 0),
    })).sort((a, b) => b.hours - a.hours);

    const zones = members.map((m) => getWorkHoursZone(m.hours, targetHours));

    if (!hourThemeColors) {
      return {
        labels: members.map((m) => m.name),
        values: members.map((m) => m.hours),
        targetMarker: {
          value: targetHours,
          label: `Target ${targetHours.toFixed(1)}h`,
          color: undefined,
        },
        suffix: 'h',
      };
    }

    return {
      labels: members.map((m) => m.name),
      values: members.map((m) => m.hours),
      colors: zones.map((z) => getWorkHoursBarFill(z, hourThemeColors)),
      borderColors: zones.map((z) => getWorkHoursBarBorder(z, hourThemeColors)),
      targetMarker: {
        value: targetHours,
        label: `Target ${targetHours.toFixed(1)}h`,
        color: hourThemeColors.markerColor,
      },
      suffix: 'h',
      flashLevels: zones.map((z, i) => getWorkHoursFlashLevel(z, members[i]?.hours ?? 0)),
      plaidOverlay: zones.map((z) => z === 'plaid'),
    };
  }, [workHours, hourThemeColors, targetHours]);

  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={`${styles.loadingWrap} ${styles.loadingOverlay}`} role="status" aria-live="polite" aria-busy="true">
          <ProgressSpinner aria-hidden />
          <span className={styles.loadingMessage}>{LOADING_NOVA_DATA_PLEASE_WAIT}</span>
        </div>
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
          {SHOW_BY_BOARD_AND_COMPONENT && (
            <Card className={styles.chartCard}>
              <div className={styles.panelHeader}>By Board &amp; Component</div>
              <ByBoardByComponentStackedBarChart data={byBoardChartData} />
            </Card>
          )}
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
