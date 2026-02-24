'use client';

import { Card } from 'primereact/card';
import { OpenedClosedFlowBarChart } from '@/components/charts';
import { TrendBadge } from '@/components/ui';
import type { OpenedClosedFlowChartData, TrendComparison } from '@/types';
import styles from './DevCornerOneDashboard.module.scss';

export interface ThroughputPanelProps {
  flowData: OpenedClosedFlowChartData;
  throughputRatio: number;
  trend: TrendComparison | null;
}

export const ThroughputPanel = ({ flowData, throughputRatio, trend }: ThroughputPanelProps) => {
  const ratioLabel = `${throughputRatio}x`;

  const header = (
    <div className={styles.panelHeader}>
      <span>Throughput (14d)</span>
      <span className={styles.panelBadges}>
        <span className={styles.ratioLabel}>{ratioLabel}</span>
        {trend && (
          <TrendBadge value={trend.closedDelta} label="closed" />
        )}
      </span>
    </div>
  );

  return (
    <Card header={header} className={styles.panelCard}>
      <div className={styles.chartWrap}>
        <OpenedClosedFlowBarChart data={flowData} />
      </div>
    </Card>
  );
};
