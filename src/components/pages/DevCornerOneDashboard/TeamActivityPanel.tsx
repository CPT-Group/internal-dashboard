'use client';

import type { CSSProperties } from 'react';
import { Badge } from 'primereact/badge';
import { Chip } from 'primereact/chip';
import { Tag } from 'primereact/tag';
import type { TeamMemberActivity } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

export interface TeamActivityPanelProps {
  members: TeamMemberActivity[];
  hoursByIssue: Map<string, Map<string, number>>;
}

const firstName = (name: string) => name.split(' ')[0] ?? name;

const formatTicketHours = (seconds: number): string => {
  if (seconds <= 0) return '0.00h';
  return `${(Math.round((seconds / 3600) * 100) / 100).toFixed(2)}h`;
};

const buildTicketSummary = (key: string, summary: string): string =>
  summary.trim() || key;

const MemberCard = ({
  m,
  hoursByIssue,
}: {
  m: TeamMemberActivity;
  hoursByIssue: Map<string, Map<string, number>>;
}) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 10, pauseMs: 4000 });

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardHeader}>
        <span className={styles.teamName}>{firstName(m.displayName)}</span>
        <span className={styles.teamCounts}>
          <Badge value={m.inProgressCount} severity="info" />
          <span>/ {m.openCount} open</span>
        </span>
      </div>
      <div ref={scrollRef} className={styles.teamTickets}>
        {m.inProgressKeys.length === 0 && (
          <span className={styles.noTickets}>No active tickets</span>
        )}
        {m.inProgressKeys.map((key, i) => (
          <Chip
            key={key}
            template={
              <div className={styles.ticketChipContent}>
                <span className={styles.ticketChipSummary}>
                  {buildTicketSummary(key, m.inProgressSummaries[i] ?? '')}
                </span>
                <Tag
                  value={formatTicketHours(hoursByIssue.get(key)?.get(m.accountId) ?? 0)}
                  rounded
                  className={styles.ticketHoursTag}
                />
              </div>
            }
            className={`${styles.ticketChip} ${
              m.inProgressIsBug[i]
                ? styles.ticketChipBug
                : key.startsWith('NOVA-')
                  ? styles.ticketChipNova
                  : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export const TeamActivityPanel = ({ members, hoursByIssue }: TeamActivityPanelProps) => {
  return (
    <div className={styles.teamSection}>
      <div
        className={styles.teamGrid}
        style={
          { '--team-columns': String(members.length) } as CSSProperties
        }
      >
        {members.map((m) => (
          <MemberCard key={m.accountId} m={m} hoursByIssue={hoursByIssue} />
        ))}
      </div>
    </div>
  );
};
