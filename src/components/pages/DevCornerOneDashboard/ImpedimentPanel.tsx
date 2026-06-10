'use client';

import { Badge } from 'primereact/badge';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { ImpedimentAnalytics, ImpedimentView } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

export interface ImpedimentPanelProps {
  analytics: ImpedimentAnalytics;
}

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const impedimentBody = (row: ImpedimentView) => (
  <div className={styles.impedimentCell}>
    <span className={row.key.startsWith('NOVA-') ? styles.novaLabel : undefined}>{row.key}</span>
    <span className={styles.impedimentSummary}>{truncate(row.summary, 48)}</span>
  </div>
);

const flagBody = (row: ImpedimentView) => (
  <div className={styles.flagCell}>
    <span className="p-overlay-badge">
      <span className={styles.storyKeyPill}>Flagged</span>
      <Badge value="!" severity="warning" />
    </span>
    <span className={styles.flagReason}>{truncate(row.flagReason, 32)}</span>
  </div>
);

export const ImpedimentPanel = ({ analytics }: ImpedimentPanelProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });
  const rows = analytics.activeImpediments;

  if (rows.length === 0) {
    return (
      <Card className={styles.panelCard}>
        <p className={styles.impedimentEmpty}>No active impediments</p>
      </Card>
    );
  }

  return (
    <Card className={styles.panelCard}>
      <div ref={scrollRef} className={styles.compTableWrap}>
        <DataTable
          value={rows}
          size="small"
          stripedRows
          className={styles.compTable}
        >
          <Column header="Impediment" body={impedimentBody} style={{ minWidth: '140px' }} />
          <Column field="statusName" header="Status" style={{ width: '90px' }} />
          <Column header="Flag" body={flagBody} style={{ minWidth: '120px' }} />
          <Column
            header="Age"
            body={(row: ImpedimentView) => `${row.ageDays}d`}
            style={{ width: '48px', textAlign: 'center' }}
          />
        </DataTable>
      </div>
    </Card>
  );
};
