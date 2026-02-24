'use client';

import { Card } from 'primereact/card';
import { HorizontalBarChart } from '@/components/charts';
import type { WorkloadByAssigneeChartData } from '@/types/charts';
import styles from './DevCornerOneDashboard.module.scss';

export interface WorkloadPanelProps {
  workloadData: WorkloadByAssigneeChartData;
}

export const WorkloadPanel = ({ workloadData }: WorkloadPanelProps) => {
  const barData = {
    labels: workloadData.labels.map(
      (name, i) => `${name} (${workloadData.percentOfTotal[i]}%)`
    ),
    values: workloadData.counts,
  };

  return (
    <Card header={<div className={styles.panelHeader}><span>Workload</span></div>} className={styles.panelCard}>
      <div className={styles.chartWrap}>
        <HorizontalBarChart data={barData} />
      </div>
    </Card>
  );
};
