'use client';

import { Skeleton } from 'primereact/skeleton';
import { useAutoScroll } from '@/hooks';
import type { AssignedJiraTicket } from '@/hooks';
import styles from './AssignedTicketsCornerCard.module.scss';

export interface AssignedTicketsCornerCardProps {
  title: string;
  tickets: AssignedJiraTicket[];
  loading: boolean;
}

/**
 * Compact corner card for assignee-scoped Jira ticket links.
 * Shows `key + component` (or summary fallback) with no-wrap truncation.
 */
export const AssignedTicketsCornerCard = ({
  title,
  tickets,
  loading,
}: AssignedTicketsCornerCardProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 12, pauseMs: 2000 });

  return (
    <div className={styles.card} role="complementary" aria-label={`${title} assigned Jira tickets`}>
      <div className={styles.header}>{title}</div>
      {loading ? (
        <div className={styles.loadingWrap} aria-hidden="true">
          <Skeleton width="12rem" height="0.95rem" />
          <Skeleton width="10rem" height="0.95rem" />
          <Skeleton width="11rem" height="0.95rem" />
        </div>
      ) : (
        <div ref={scrollRef} className={styles.listWrap}>
          {tickets.map((ticket) => (
            <a
              key={ticket.key}
              className={styles.row}
              href={ticket.ticketUrl}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${ticket.key} ${ticket.component ?? ticket.summary}`}
              title={ticket.component ?? ticket.summary}
            >
              <span className={styles.key}>{ticket.key}</span>
              <span className={styles.detail}>{ticket.component ?? ticket.summary}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

