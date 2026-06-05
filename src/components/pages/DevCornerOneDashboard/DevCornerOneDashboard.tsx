'use client';

import { useEffect, useMemo } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { LOADING_NOVA_DATA_PLEASE_WAIT } from '@/constants';
import { useOperationalJiraStore } from '@/stores';
import { useWorkHoursToday } from '@/hooks';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { WorkHoursTodayPanel } from './WorkHoursTodayPanel';
// import { ComponentActivityPanel } from './ComponentActivityPanel';
import { ImpedimentPanel } from './ImpedimentPanel';
import { TeamActivityPanel } from './TeamActivityPanel';
import styles from './DevCornerOneDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

const formatCloseTime = (hours: number | null): string => {
  if (hours == null) return '—';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

export const DevCornerOneDashboard = () => {
  const { cycleTheme } = useTheme();
  const { hours, hoursByIssue, loading: workHoursLoading } = useWorkHoursToday();
  const {
    fetchOperationalData,
    fetchImpedimentData,
    isStale,
    isImpedimentStale,
    loading,
    error,
    getAnalytics,
    impedimentAnalytics,
  } =
    useOperationalJiraStore();

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    if (isImpedimentStale()) void fetchImpedimentData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
      if (isImpedimentStale()) void fetchImpedimentData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchImpedimentData, fetchOperationalData, isImpedimentStale, isStale]);

  const analytics = getAnalytics();
  const { kpis, throughputRatio, teamActivity } = analytics;

  const kpiItems: KpiItem[] = useMemo(() => [
    {
      label: 'Limbo',
      value: kpis.limboCount,
      severity: kpis.limboCount > 0 ? 'warning' : 'success',
      onActivate: cycleTheme,
    },
    {
      label: 'Impediments',
      value: impedimentAnalytics.impedimentCount,
      severity: impedimentAnalytics.impedimentCount > 0 ? 'warning' : 'success',
    },
    { label: 'Landed Today', value: kpis.landedToday },
    { label: 'Closed Today', value: kpis.closedToday },
    {
      label: 'Net Today',
      value: `${kpis.netChangeToday > 0 ? '+' : ''}${kpis.netChangeToday}`,
      severity: kpis.netChangeToday > 0 ? 'danger' : kpis.netChangeToday < 0 ? 'success' : 'info',
    },
    { label: 'Avg Close', value: formatCloseTime(kpis.avgCloseTimeHours) },
    {
      label: 'Throughput',
      value: `${throughputRatio}x`,
      severity: throughputRatio >= 1 ? 'success' : throughputRatio >= 0.7 ? 'warning' : 'danger',
    },
  ], [kpis, throughputRatio, impedimentAnalytics.impedimentCount, cycleTheme]);

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={`${styles.loadingWrap} ${styles.loadingOverlay}`} role="status" aria-live="polite" aria-busy="true">
          <ProgressSpinner aria-hidden />
          <span>{LOADING_NOVA_DATA_PLEASE_WAIT}</span>
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
      <div className={styles.middleRow}>
        <div className={styles.leftCol}>
          <WorkHoursTodayPanel hours={hours} loading={workHoursLoading} />
        </div>
        <div className={styles.rightCol}>
          <ImpedimentPanel analytics={impedimentAnalytics} />
          {/* <ComponentActivityPanel components={componentActivity} /> */}
        </div>
      </div>
      <div className={styles.bottomRow}>
        <TeamActivityPanel members={teamActivity} hoursByIssue={hoursByIssue} />
      </div>
    </div>
  );
};
