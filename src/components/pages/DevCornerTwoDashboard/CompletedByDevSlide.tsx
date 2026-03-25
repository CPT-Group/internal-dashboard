'use client';

import { useMemo } from 'react';
import type { CompletedByDeveloperColumn } from '@/types';
import { useAutoScroll } from '@/hooks';
import { DevCornerSlideHero } from '@/components/ui';
import styles from './CompletedByDevSlide.module.scss';

export interface CompletedByDevSlideProps {
  columns: CompletedByDeveloperColumn[];
}

const isNovaKey = (key: string) => key.startsWith('NOVA-');

export const CompletedByDevSlide = ({ columns }: CompletedByDevSlideProps) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 10, pauseMs: 4000 });

  const totals = useMemo(() => {
    let today = 0;
    let week = 0;
    for (const c of columns) {
      today += c.todayTickets.length;
      week += c.weekTotalCount;
    }
    return { today, week };
  }, [columns]);

  return (
    <div className={styles.root}>
      <DevCornerSlideHero
        title="Completions by developer"
        pill="Today"
        description={
          <>
            <span>
              Same data as operational fetch — no extra Jira calls. Week = Mon–Fri window (through
              today).
            </span>
            <span>
              · Today: <strong>{totals.today}</strong> · Week: <strong>{totals.week}</strong>
            </span>
          </>
        }
      />
      <div ref={scrollRef} className={styles.scroll}>
        <div className={styles.grid}>
          {columns.map((col) => (
            <div key={col.accountId} className={styles.column}>
              <div className={styles.columnHead}>
                <div className={styles.name}>{col.firstName}</div>
                <div className={styles.stats}>
                  <span>
                    <span className={styles.statLabel}>Today</span> {col.todayTickets.length}
                  </span>
                  <span>
                    <span className={styles.statLabel}>Week</span> {col.weekTotalCount}
                  </span>
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Today</div>
                <div className={styles.ticketList}>
                  {col.todayTickets.length === 0 && (
                    <div className={styles.empty}>None yet</div>
                  )}
                  {col.todayTickets.map((t) => (
                    <div
                      key={t.key}
                      className={`${styles.ticket} ${isNovaKey(t.key) ? styles.ticketNova : ''}`}
                    >
                      <div
                        className={`${styles.ticketKey} ${isNovaKey(t.key) ? styles.ticketKeyNova : ''}`}
                      >
                        {t.key}
                      </div>
                      <div className={styles.summary}>{t.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Earlier this week</div>
                <div className={styles.ticketList}>
                  {col.weekTicketsNonToday.length === 0 && (
                    <div className={styles.empty}>None</div>
                  )}
                  {col.weekTicketsNonToday.map((t) => (
                    <div
                      key={t.key}
                      className={`${styles.ticket} ${isNovaKey(t.key) ? styles.ticketNova : ''}`}
                    >
                      <div
                        className={`${styles.ticketKey} ${isNovaKey(t.key) ? styles.ticketKeyNova : ''}`}
                      >
                        {t.key}
                      </div>
                      <div className={styles.summary}>{t.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
