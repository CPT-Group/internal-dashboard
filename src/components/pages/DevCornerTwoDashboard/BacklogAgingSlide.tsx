'use client';

import { Card } from 'primereact/card';
import { HorizontalBarChart } from '@/components/charts';
import type { HorizontalBarChartData } from '@/types/charts';
import styles from './DevCornerTwoDashboard.module.scss';

export interface BacklogAgingSlideProps {
  backlogData: HorizontalBarChartData;
  agingData: HorizontalBarChartData;
}

export const BacklogAgingSlide = ({ backlogData, agingData }: BacklogAgingSlideProps) => (
  <div className={styles.slideContent}>
    <div className={styles.slideTitle}>
      <span>Backlog & Aging</span>
    </div>
    <div className={styles.splitRow}>
      <div className={styles.splitCol}>
        <Card title="By Component" className="flex-1 flex flex-column min-h-0">
          <div className={styles.chartWrap}>
            <HorizontalBarChart data={backlogData} />
          </div>
        </Card>
      </div>
      <div className={styles.splitCol}>
        <Card title="Aging Buckets" className="flex-1 flex flex-column min-h-0">
          <div className={styles.chartWrap}>
            <HorizontalBarChart data={agingData} />
          </div>
        </Card>
      </div>
    </div>
  </div>
);
