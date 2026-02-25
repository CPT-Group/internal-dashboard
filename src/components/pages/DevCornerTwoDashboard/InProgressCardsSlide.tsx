'use client';

import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import type { InProgressTicket } from '@/types';
import styles from './DevCornerTwoDashboard.module.scss';

export interface InProgressCardsSlideProps {
  tickets: InProgressTicket[];
}

const statusSeverity = (status: string): 'info' | 'warning' | 'success' => {
  const lower = status.toLowerCase();
  if (lower.includes('review') || lower.includes('qa') || lower.includes('uat')) return 'warning';
  if (lower.includes('done') || lower.includes('complete')) return 'success';
  return 'info';
};

export const InProgressCardsSlide = ({ tickets }: InProgressCardsSlideProps) => (
  <div className={styles.slideContent}>
    <div className={styles.slideTitle}>
      <span>In Progress ({tickets.length})</span>
    </div>
    <div className={styles.cardGrid}>
      {tickets.map((t) => (
        <Card key={t.key} className={styles.ticketCard}>
          <div className={styles.ticketKey}>{t.key}</div>
          <div className={styles.ticketSummary}>{t.summary}</div>
          <div className={styles.ticketMeta}>
            <Tag value={t.status} severity={statusSeverity(t.status)} />
            <span className={styles.ticketMetaItem}>{t.assignee}</span>
            {t.component && <span className={styles.ticketMetaItem}>{t.component}</span>}
            <span className={styles.ticketMetaItem}>{t.ageDays}d</span>
          </div>
        </Card>
      ))}
      {tickets.length === 0 && (
        <span className={styles.ticketMetaItem}>No tickets in progress</span>
      )}
    </div>
  </div>
);
