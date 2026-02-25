'use client';

import { Card } from 'primereact/card';
import { Badge } from 'primereact/badge';
import { Chip } from 'primereact/chip';
import type { TeamMemberActivity } from '@/types';
import styles from './DevCornerOneDashboard.module.scss';

export interface TeamActivityPanelProps {
  members: TeamMemberActivity[];
}

const firstName = (name: string) => name.split(' ')[0] ?? name;

export const TeamActivityPanel = ({ members }: TeamActivityPanelProps) => {
  const header = (
    <div className={styles.panelHeader}>
      <span>NOVA Team</span>
      <Badge
        value={members.reduce((s, m) => s + m.inProgressCount, 0) + ' active'}
        severity="info"
      />
    </div>
  );

  return (
    <Card header={header} className={styles.panelCard}>
      <div className={styles.teamGrid}>
        {members.map((m) => (
          <div key={m.accountId} className={styles.teamCard}>
            <div className={styles.teamCardHeader}>
              <span className={styles.teamName}>{firstName(m.displayName)}</span>
              <span className={styles.teamCounts}>
                <Badge value={m.inProgressCount} severity="info" />
                <span className={styles.muted}>/ {m.openCount} open</span>
              </span>
            </div>
            <div className={styles.teamTickets}>
              {m.inProgressKeys.length === 0 && (
                <span className={styles.muted}>No active tickets</span>
              )}
              {m.inProgressKeys.slice(0, 3).map((key, i) => (
                <Chip key={key} label={`${key}: ${m.inProgressSummaries[i]?.slice(0, 30) ?? ''}`} className={styles.ticketChip} />
              ))}
              {m.inProgressKeys.length > 3 && (
                <span className={styles.muted}>+{m.inProgressKeys.length - 3} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
