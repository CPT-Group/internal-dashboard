'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { ComponentActivity } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

export interface ComponentActivityPanelProps {
  components: ComponentActivity[];
}

const countBadge = (value: number, severity: 'info' | 'warning' | 'muted') => (
  <span className={`${styles.countBadge} ${styles[severity]}`}>{value}</span>
);

const todayBody = (row: ComponentActivity) =>
  countBadge(row.landedToday, row.landedToday > 0 ? 'info' : 'muted');

const weekBody = (row: ComponentActivity) =>
  countBadge(row.landedThisWeek, row.landedThisWeek > 0 ? 'warning' : 'muted');

const openBody = (row: ComponentActivity) => (
  <span className={row.hasAging ? styles.agingValue : ''}>{row.openCount}</span>
);

const nameBody = (row: ComponentActivity) => {
  const label = row.component.length > 18 ? row.component.slice(0, 16) + '…' : row.component;
  return row.isNova
    ? <span className={styles.novaLabel}>{label}</span>
    : label;
};

export const ComponentActivityPanel = ({ components }: ComponentActivityPanelProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });

  const header = (
    <div className={styles.panelHeader}>
      <span>Component Activity</span>
    </div>
  );

  const rowClass = (row: ComponentActivity) => (row.isNova ? styles.novaRow : '');

  return (
    <Card header={header} className={styles.panelCard}>
      <div ref={scrollRef} className={styles.compTableWrap}>
        <DataTable
          value={components}
          size="small"
          stripedRows
          className={styles.compTable}
          rowClassName={rowClass}
        >
          <Column header="Component" body={nameBody} style={{ minWidth: '100px' }} />
          <Column header="Open" body={openBody} style={{ width: '55px', textAlign: 'center' }} />
          <Column header="Today" body={todayBody} style={{ width: '55px', textAlign: 'center' }} />
          <Column header="Week" body={weekBody} style={{ width: '55px', textAlign: 'center' }} />
        </DataTable>
      </div>
    </Card>
  );
};
