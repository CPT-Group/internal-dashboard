'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import type { RequestedTicket } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerTwoDashboard.module.scss';

export interface RequestedTicketsSlideProps {
  tickets: RequestedTicket[];
}

const summaryBody = (row: RequestedTicket) =>
  row.summary.length > 50 ? row.summary.slice(0, 47) + '…' : row.summary;

const componentBody = (row: RequestedTicket) =>
  row.component.length > 14 ? row.component.slice(0, 12) + '…' : row.component;

const ageBody = (row: RequestedTicket) => {
  const severity = row.ageDays > 7 ? 'danger' : row.ageDays > 3 ? 'warning' : 'info';
  return <Tag value={`${row.ageDays}d`} severity={severity} />;
};

export const RequestedTicketsSlide = ({ tickets }: RequestedTicketsSlideProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });

  return (
    <div className={styles.slideContent}>
      <div className={styles.slideTitle}>
        <span>Requested — Not Yet Started</span>
        <Tag value={`${tickets.length} waiting`} severity="warning" />
      </div>
      <Card className={styles.tableCard}>
        <div ref={scrollRef} className={styles.tableScrollWrap}>
          <DataTable
            value={tickets}
            size="small"
            stripedRows
            showGridlines
            className={styles.completedTable}
            emptyMessage="No tickets waiting — all caught up!"
          >
            <Column field="key" header="Key" style={{ width: '80px' }} />
            <Column field="summary" header="Summary" body={summaryBody} />
            <Column field="assignee" header="Assignee" style={{ width: '100px' }} />
            <Column field="component" header="Component" style={{ width: '100px' }} body={componentBody} />
            <Column field="status" header="Status" style={{ width: '100px' }} />
            <Column header="Age" body={ageBody} style={{ width: '55px' }} />
            <Column field="project" header="Project" style={{ width: '60px' }} />
          </DataTable>
        </div>
      </Card>
    </div>
  );
};
