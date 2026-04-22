'use client';

import { useEffect, useMemo } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { LOADING_NOVA_DATA_PLEASE_WAIT } from '@/constants';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip, ThemeCycleHitTarget } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { WorkHoursTodayPanel } from './WorkHoursTodayPanel';
import { ComponentActivityPanel } from './ComponentActivityPanel';
import { TeamActivityPanel } from './TeamActivityPanel';
import styles from './DevCornerOneDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

const formatCloseTime = (hours: number | null): string => {
  if (hours == null) return '—';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

export const DevCornerOneDashboard = () => {
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
  const { kpis, throughputRatio, componentActivity, teamActivity } = analytics;

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'Limbo', value: kpis.limboCount, severity: kpis.limboCount > 0 ? 'warning' : 'success' },
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
  ], [kpis, throughputRatio]);

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.kpiRow}>
          <ThemeCycleHitTarget variant="strip" />
          <div className={styles.kpiStripWrap} />
        </div>
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
        <div className={styles.kpiRow}>
          <ThemeCycleHitTarget variant="strip" />
          <div className={styles.kpiStripWrap} />
        </div>
        <Message severity="error" text={error} className={`w-full ${styles.dashboardMessage}`} />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.kpiRow}>
        <ThemeCycleHitTarget variant="strip" />
        <div className={styles.kpiStripWrap}>
          <KpiStrip items={kpiItems} />
        </div>
      </div>
      <div className={styles.middleRow}>
        <div className={styles.leftCol}>
          <WorkHoursTodayPanel />
        </div>
        <div className={styles.rightCol}>
          <ComponentActivityPanel components={componentActivity} />
        </div>
      </div>
      <div className={styles.bottomRow}>
        <TeamActivityPanel members={teamActivity} />
      </div>
    </div>
  );
};
