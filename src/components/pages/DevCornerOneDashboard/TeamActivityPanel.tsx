'use client';

import type { CSSProperties } from 'react';
import { Chip } from 'primereact/chip';
import { Tag } from 'primereact/tag';
import { MarqueeTicker } from '@/components/ui';
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

const buildTicketNumberLabel = (key: string): string => {
  const match = /^([^-]+)-(\d+)$/.exec(key.trim());
  if (!match) return key;
  return match[2];
};

type TicketChipRow = {
  key: string;
  summary: string;
  isBug: boolean;
  muted: boolean;
};

const TicketChip = ({
  row,
  accountId,
  hoursByIssue,
}: {
  row: TicketChipRow;
  accountId: string;
  hoursByIssue: Map<string, Map<string, number>>;
}) => {
  const { key, summary, isBug, muted } = row;
  const chipClass = [
    styles.ticketChip,
    muted
      ? styles.ticketChipTodo
      : isBug
        ? styles.ticketChipBug
        : key.startsWith('NOVA-')
          ? styles.ticketChipNova
          : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Chip
      key={key}
      template={
        <div className={styles.ticketChipContent}>
          <span className={styles.ticketChipKey}>{buildTicketNumberLabel(key)}</span>
          <span className={styles.ticketChipSummary}>
            <MarqueeTicker
              text={buildTicketSummary(key, summary)}
              className={styles.ticketChipSummaryTicker}
              durationSeconds={20}
              gapRem={1.5}
            />
          </span>
          <Tag
            value={formatTicketHours(hoursByIssue.get(key)?.get(accountId) ?? 0)}
            rounded
            className={styles.ticketHoursTag}
          />
        </div>
      }
      className={chipClass}
    />
  );
};

const MemberCard = ({
  m,
  hoursByIssue,
}: {
  m: TeamMemberActivity;
  hoursByIssue: Map<string, Map<string, number>>;
}) => {
  const scrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 10, pauseMs: 4000 });

  const inProgressRows: TicketChipRow[] = m.inProgressKeys.map((key, i) => ({
    key,
    summary: m.inProgressSummaries[i] ?? '',
    isBug: m.inProgressIsBug[i] ?? false,
    muted: false,
  }));
  const todoRows: TicketChipRow[] = m.todoKeys.map((key, i) => ({
    key,
    summary: m.todoSummaries[i] ?? '',
    isBug: m.todoIsBug[i] ?? false,
    muted: true,
  }));
  const ticketRows = [...inProgressRows, ...todoRows];

  return (
    <div className={styles.teamCard}>
      <div className={styles.teamCardHeader}>
        <span className={styles.teamName}>{firstName(m.displayName)}</span>
        <span className={styles.teamCounts}>
          <span className={styles.teamCountInDev}>
            {m.inProgressCount} IN DEV
          </span>
          <span className={styles.teamCountSeparator}>/</span>
          <span className={styles.teamCountTodo}>
            {m.todoCount} TO DO
          </span>
        </span>
      </div>
      <div ref={scrollRef} className={styles.teamTickets}>
        {ticketRows.length === 0 && (
          <span className={styles.noTickets}>No active tickets</span>
        )}
        {ticketRows.map((row) => (
          <TicketChip
            key={row.key}
            row={row}
            accountId={m.accountId}
            hoursByIssue={hoursByIssue}
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
