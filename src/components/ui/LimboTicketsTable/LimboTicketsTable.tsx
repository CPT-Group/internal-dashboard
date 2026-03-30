'use client';

import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { LimboTicket } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './LimboTicketsTable.module.scss';

interface LimboTicketsTableProps {
  tickets: LimboTicket[];
}

export const LimboTicketsTable = ({ tickets }: LimboTicketsTableProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>();

  const keyBody = (row: LimboTicket) => (
    <span className={`${styles.key} ${row.isNova ? styles.keyNova : ''}`}>
      {row.key}
    </span>
  );

  const ageBody = (row: LimboTicket) => (
    <span className={row.ageDays >= 7 ? styles.ageWarn : ''}>
      {row.ageDays}d
    </span>
  );

  const rowClass = (row: LimboTicket) =>
    row.isNova ? styles.rowNova : '';

  return (
    <div ref={scrollRef} className={styles.root}>
      <DataTable
        value={tickets}
        size="small"
        stripedRows
        scrollable
        scrollHeight="flex"
        className={styles.table}
        rowClassName={rowClass}
      >
        <Column header="Key" body={keyBody} style={{ width: '7rem' }} />
        <Column header="Project" field="project" style={{ width: '4.5rem' }} />
        <Column header="Status" field="status" style={{ width: '7rem' }} />
        <Column header="Assignee" field="assignee" style={{ width: '7.5rem' }} />
        <Column header="Summary" field="summary" style={{ minWidth: '10rem' }} />
        <Column header="Age" body={ageBody} style={{ width: '3.5rem', textAlign: 'right' }} />
      </DataTable>
    </div>
  );
};
