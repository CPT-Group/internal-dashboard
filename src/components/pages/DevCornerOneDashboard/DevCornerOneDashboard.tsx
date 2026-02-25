'use client';

import { useEffect, useMemo } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { toOpenedClosedFlowChartData } from '@/utils/chartDataMappers';
import { ThroughputPanel } from './ThroughputPanel';
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
  const { kpis, throughputRatio, trendVsPrevious14d, componentActivity, teamActivity } = analytics;

  const flowData = useMemo(() => toOpenedClosedFlowChartData(analytics), [analytics]);

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'Open', value: kpis.openCount },
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
        <div className={styles.loadingWrap}>
          <ProgressSpinner />
          <span>Loading...</span>
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
          <ThroughputPanel
            flowData={flowData}
            throughputRatio={throughputRatio}
            trend={trendVsPrevious14d}
          />
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
