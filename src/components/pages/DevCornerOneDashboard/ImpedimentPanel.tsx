'use client';

import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
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

const blocksBody = (row: ImpedimentView) => (
  <div className={styles.blocksCell}>
    <span className={`${styles.countBadge} ${styles.muted}`}>{row.blockedStories.length}</span>
    <div className={styles.storyKeyChips}>
      {row.blockedStories.map((story) => (
        <Tag
          key={story.key}
          value={story.key}
          className={story.key.startsWith('NOVA-') ? styles.storyKeyTagNova : styles.storyKeyTag}
        />
      ))}
    </div>
  </div>
);

const storyOwnersBody = (row: ImpedimentView) => {
  const owners = [...new Set(row.blockedStories.map((s) => s.techOwnerName))];
  return owners.join(', ');
};

export const ImpedimentPanel = ({ analytics }: ImpedimentPanelProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 3000 });
  const rows = analytics.activeImpediments;

  const header = (
    <div className={styles.panelHeader}>
      <span>Active Impediments</span>
      {analytics.impedimentCount > 0 && (
        <span className={styles.panelBadges}>
          <Tag severity="warning" value={`${analytics.impactedStoryCount} stories blocked`} />
        </span>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <Card header={header} className={styles.panelCard}>
        <p className={styles.impedimentEmpty}>No active impediments</p>
      </Card>
    );
  }

  return (
    <Card header={header} className={styles.panelCard}>
      <div ref={scrollRef} className={styles.compTableWrap}>
        <DataTable value={rows} size="small" stripedRows className={styles.compTable}>
          <Column header="Impediment" body={impedimentBody} style={{ minWidth: '140px' }} />
          <Column field="statusName" header="Status" style={{ width: '90px' }} />
          <Column field="assigneeName" header="Owner" style={{ width: '100px' }} />
          <Column header="Blocks" body={blocksBody} style={{ minWidth: '120px' }} />
          <Column header="Story owner" body={storyOwnersBody} style={{ minWidth: '100px' }} />
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
