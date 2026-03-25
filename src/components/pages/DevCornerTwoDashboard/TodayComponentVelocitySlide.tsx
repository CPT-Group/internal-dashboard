'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import type { TodayComponentVelocityRow } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerTwoDashboard.module.scss';

export interface TodayComponentVelocitySlideProps {
  rows: TodayComponentVelocityRow[];
}

const fmt = (h: number | null) => (h == null ? '–' : `${h}h`);

export const TodayComponentVelocitySlide = ({ rows }: TodayComponentVelocitySlideProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 10, pauseMs: 3500 });

  return (
    <div className={styles.slideContent}>
      <div className={`${styles.slideTitle} ${styles.slideTitleStacked}`}>
        <div className={styles.todaySlideHeading}>
          <span>Close times today — by component</span>
          <Tag value="Today" severity="success" />
        </div>
        <span className={styles.todaySlideSub}>
          Resolved today · NOVA team tech owners · CM, OPRD & NOVA
        </span>
      </div>
      <Card className={styles.tableCard}>
        <div ref={scrollRef} className={styles.tableScrollWrap}>
          <DataTable
            value={rows}
            size="small"
            stripedRows
            showGridlines
            className={styles.completedTable}
            emptyMessage="No tickets completed today yet — check back after closes land."
          >
            <Column field="component" header="Component" style={{ minWidth: '120px' }} />
            <Column field="completedCount" header="#" style={{ width: '48px' }} />
            <Column field="avgHours" header="Avg" body={(r: TodayComponentVelocityRow) => fmt(r.avgHours)} style={{ width: '56px' }} />
            <Column
              field="fastestHours"
              header="Fastest"
              body={(r: TodayComponentVelocityRow) => fmt(r.fastestHours)}
              style={{ width: '64px' }}
            />
            <Column field="fastestTechOwner" header="By" style={{ width: '100px' }} />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};
