'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Badge } from 'primereact/badge';
import type { ComponentActivity } from '@/types';
import styles from './DevCornerOneDashboard.module.scss';

export interface ComponentActivityPanelProps {
  components: ComponentActivity[];
}

const todayBody = (row: ComponentActivity) =>
  row.landedToday > 0 ? <Badge value={row.landedToday} severity="info" /> : <span className={styles.muted}>0</span>;

const weekBody = (row: ComponentActivity) =>
  row.landedThisWeek > 0 ? <Badge value={row.landedThisWeek} severity="warning" /> : <span className={styles.muted}>0</span>;

const openBody = (row: ComponentActivity) => (
  <span className={row.hasAging ? styles.agingValue : ''}>{row.openCount}</span>
);

const nameBody = (row: ComponentActivity) =>
  row.component.length > 18 ? row.component.slice(0, 16) + '…' : row.component;

export const ComponentActivityPanel = ({ components }: ComponentActivityPanelProps) => {
  const header = (
    <div className={styles.panelHeader}>
      <span>Component Activity</span>
    </div>
  );

  return (
    <Card header={header} className={styles.panelCard}>
      <DataTable
        value={components}
        size="small"
        scrollable
        scrollHeight="flex"
        stripedRows
        className={styles.compTable}
      >
        <Column header="Component" body={nameBody} style={{ minWidth: '100px' }} />
        <Column header="Open" body={openBody} style={{ width: '55px' }} />
        <Column header="Today" body={todayBody} style={{ width: '55px' }} />
        <Column header="Week" body={weekBody} style={{ width: '55px' }} />
      </DataTable>
    </Card>
  );
};
