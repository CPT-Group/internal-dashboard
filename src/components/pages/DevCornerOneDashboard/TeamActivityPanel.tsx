'use client';

import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { Chip } from 'primereact/chip';
import type { TeamMemberActivity } from '@/types';
import { useAutoScroll } from '@/hooks';
import styles from './DevCornerOneDashboard.module.scss';

export interface TeamActivityPanelProps {
  members: TeamMemberActivity[];
}

const firstName = (name: string) => name.split(' ')[0] ?? name;

const MemberCard = ({ m }: { m: TeamMemberActivity }) => {
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
            label={`${key}: ${m.inProgressSummaries[i]?.slice(0, 35) ?? ''}`}
            className={styles.ticketChip}
          />
        ))}
      </div>
    </div>
  );
};

export const TeamActivityPanel = ({ members }: TeamActivityPanelProps) => {
  const totalActive = members.reduce((s, m) => s + m.inProgressCount, 0);

  const header = (
    <div className={styles.panelHeader}>
      <span>NOVA Team</span>
      <Badge value={`${totalActive} active`} severity="info" />
    </div>
  );

  return (
    <Card header={header} className={styles.panelCard}>
      <div className={styles.teamGrid}>
        {members.map((m) => (
          <MemberCard key={m.accountId} m={m} />
        ))}
      </div>
    </Card>
  );
};
