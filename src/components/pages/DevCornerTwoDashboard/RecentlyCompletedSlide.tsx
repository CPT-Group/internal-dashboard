'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import type { RecentlyCompletedTicket } from '@/types';
import styles from './DevCornerTwoDashboard.module.scss';

export interface RecentlyCompletedSlideProps {
  tickets: RecentlyCompletedTicket[];
}

const summaryBody = (row: RecentlyCompletedTicket) =>
  row.summary.length > 50 ? row.summary.slice(0, 47) + '…' : row.summary;

const componentBody = (row: RecentlyCompletedTicket) =>
  row.component.length > 14 ? row.component.slice(0, 12) + '…' : row.component;

const dateBody = (row: RecentlyCompletedTicket) => row.resolvedDate.slice(5);

export const RecentlyCompletedSlide = ({ tickets }: RecentlyCompletedSlideProps) => (
  <div className={styles.slideContent}>
    <div className={styles.slideTitle}>
      <span>Recently Completed (7d)</span>
      <Tag value={`${tickets.length} items`} severity="success" />
    </div>
    <Card className="flex-1 flex flex-column min-h-0">
      <DataTable
        value={tickets}
        size="small"
        scrollable
        scrollHeight="flex"
        stripedRows
        showGridlines
        className={styles.completedTable}
        emptyMessage="No recently completed tickets"
      >
        <Column field="key" header="Key" style={{ width: '80px' }} />
        <Column field="summary" header="Summary" body={summaryBody} />
        <Column field="assignee" header="Assignee" style={{ width: '100px' }} />
        <Column field="component" header="Component" style={{ width: '100px' }} body={componentBody} />
        <Column field="resolvedDate" header="Resolved" style={{ width: '70px' }} body={dateBody} />
        <Column field="project" header="Project" style={{ width: '60px' }} />
      </DataTable>
    </Card>
  </div>
);
