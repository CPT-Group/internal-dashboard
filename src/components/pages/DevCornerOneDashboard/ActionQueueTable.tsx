'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import type { OldestTicketRow } from '@/types';
import { DEV1_STALE_DAYS_THRESHOLD } from '@/constants';
import styles from './DevCornerOneDashboard.module.scss';

export interface ActionQueueTableProps {
  tickets: OldestTicketRow[];
}

const ageSeverity = (days: number): 'danger' | 'warning' | 'info' => {
  if (days >= DEV1_STALE_DAYS_THRESHOLD) return 'danger';
  if (days >= 8) return 'warning';
  return 'info';
};

const summaryBody = (row: OldestTicketRow) =>
  row.summary.length > 40 ? row.summary.slice(0, 37) + '…' : row.summary;

const ageBody = (row: OldestTicketRow) => (
  <Tag value={`${row.ageDays}d`} severity={ageSeverity(row.ageDays)} />
);

const componentBody = (row: OldestTicketRow) =>
  row.component.length > 12 ? row.component.slice(0, 10) + '…' : row.component;

export const ActionQueueTable = ({ tickets }: ActionQueueTableProps) => {
  return (
    <Card header={<div className={styles.panelHeader}><span>Action Queue</span></div>} className={styles.panelCard}>
      <DataTable
        value={tickets}
        size="small"
        scrollable
        scrollHeight="flex"
        stripedRows
        showGridlines
        className={styles.actionTable}
      >
        <Column field="key" header="Key" style={{ width: '80px' }} />
        <Column field="summary" header="Summary" body={summaryBody} />
        <Column field="assignee" header="Assignee" style={{ width: '90px' }} />
        <Column field="component" header="Comp" style={{ width: '80px' }} body={componentBody} />
        <Column field="ageDays" header="Age" style={{ width: '60px' }} body={ageBody} />
      </DataTable>
    </Card>
  );
};
