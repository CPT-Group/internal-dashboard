'use client';

import { useEffect, useMemo } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import {
  toOpenedClosedFlowChartData,
  toAgingBucketsBarChartData,
  toWorkloadByAssigneeChartData,
} from '@/utils/chartDataMappers';
import { ThroughputPanel } from './ThroughputPanel';
import { RiskPanel } from './RiskPanel';
import { WorkloadPanel } from './WorkloadPanel';
import { ActionQueueTable } from './ActionQueueTable';
import styles from './DevCornerOneDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

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
  const { kpis, oldest10, throughputRatio, riskScore, agingHotspots, trendVsPrevious14d } = analytics;

  const flowData = useMemo(() => toOpenedClosedFlowChartData(analytics), [analytics]);
  const agingData = useMemo(() => toAgingBucketsBarChartData(analytics), [analytics]);
  const workloadData = useMemo(() => toWorkloadByAssigneeChartData(analytics), [analytics]);

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'Open', value: kpis.openCount },
    { label: 'Opened Today', value: kpis.openedToday },
    { label: 'Closed Today', value: kpis.closedToday },
    {
      label: 'Net Today',
      value: `${kpis.netChangeToday > 0 ? '+' : ''}${kpis.netChangeToday}`,
      severity: kpis.netChangeToday > 0 ? 'danger' : kpis.netChangeToday < 0 ? 'success' : 'info',
    },
    { label: 'Avg Age', value: `${kpis.avgAgeDays}d` },
    { label: 'Oldest', value: `${kpis.oldestAgeDays}d` },
  ], [kpis]);

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
      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <ThroughputPanel
            flowData={flowData}
            throughputRatio={throughputRatio}
            trend={trendVsPrevious14d}
          />
        </div>
        <div className={styles.rightCol}>
          <RiskPanel
            agingData={agingData}
            hotspots={agingHotspots}
            riskScore={riskScore}
          />
        </div>
      </div>
      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <WorkloadPanel workloadData={workloadData} />
        </div>
        <div className={styles.rightCol}>
          <ActionQueueTable tickets={oldest10} />
        </div>
      </div>
    </div>
  );
};
