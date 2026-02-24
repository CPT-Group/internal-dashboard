'use client';

import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData, AgingHotspot } from '@/types';
import styles from './DevCornerOneDashboard.module.scss';

export interface RiskPanelProps {
  agingData: HorizontalBarChartData;
  hotspots: AgingHotspot[];
  riskScore: number;
}

const riskSeverity = (score: number): 'success' | 'warning' | 'danger' => {
  if (score < 30) return 'success';
  if (score < 60) return 'warning';
  return 'danger';
};

export const RiskPanel = ({ agingData, hotspots, riskScore }: RiskPanelProps) => {
  const header = (
    <div className={styles.panelHeader}>
      <span>Risk & Aging</span>
      <Tag value={`Risk ${riskScore}`} severity={riskSeverity(riskScore)} />
    </div>
  );

  return (
    <Card header={header} className={styles.panelCard}>
      <div className={styles.chartWrapSmall}>
        <HorizontalBarChart data={agingData} />
      </div>
      {hotspots.length > 0 && (
        <div className={styles.hotspotList}>
          <div className={styles.hotspotTitle}>Hotspots</div>
          {hotspots.map((h) => (
            <div key={`${h.component}-${h.assignee}`} className={styles.hotspotRow}>
              <span className={styles.hotspotLabel}>
                {h.component} &ndash; {h.assignee}
              </span>
              <span className={styles.hotspotValue}>{h.avgAgeDays}d avg ({h.count})</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
