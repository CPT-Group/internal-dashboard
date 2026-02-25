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
          <div key={m.accountId} className={styles.teamCard}>
            <div className={styles.teamCardHeader}>
              <span className={styles.teamName}>{firstName(m.displayName)}</span>
              <span className={styles.teamCounts}>
                <Badge value={m.inProgressCount} severity="info" />
                <span>/ {m.openCount} open</span>
              </span>
            </div>
            <div className={styles.teamTickets}>
              {m.inProgressKeys.length === 0 && (
                <span className={styles.noTickets}>No active tickets</span>
              )}
              {m.inProgressKeys.slice(0, 4).map((key, i) => (
                <Chip
                  key={key}
                  label={`${key}: ${m.inProgressSummaries[i]?.slice(0, 35) ?? ''}`}
                  className={styles.ticketChip}
                />
              ))}
              {m.inProgressKeys.length > 4 && (
                <span className={styles.noTickets}>+{m.inProgressKeys.length - 4} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
