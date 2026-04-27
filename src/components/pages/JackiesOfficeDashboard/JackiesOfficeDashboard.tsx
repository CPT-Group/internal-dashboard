'use client';

import { AssignedTicketsCornerCard, BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JACKIES_BACKGROUND_SLIDES } from '@/constants';
import { useAssignedJiraTickets, useCompletedTodayCount, useSyncedClock } from '@/hooks';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './JackiesOfficeDashboard.module.css';

const JACKIE_JIRA_ACCOUNT_ID = '6170ed0ef6da6a006aa38240';

/**
 * Jackie's Office dashboard – rotating background from
 * public/backgrounds/jackies-cute-backgrounds/. Floating corner card with name/title.
 */
export const JackiesOfficeDashboard = () => {
  const { cycleTheme } = useTheme();
  const { completedToday, loading: completedTodayLoading } = useCompletedTodayCount();
  const { tickets: assignedTickets, loading: assignedTicketsLoading } =
    useAssignedJiraTickets(JACKIE_JIRA_ACCOUNT_ID);
  const { timeLabel, dateLabel } = useSyncedClock();

  return (
    <div className={styles.jackiesDashboardContent}>
      <BackgroundSlideshow
        slides={JACKIES_BACKGROUND_SLIDES}
        intervalMs={60000}
        transitionDurationMs={2500}
        transition="fade"
      />
      <div className={styles.cornerWrap}>
        <CornerInfoCard
          name="Jackie"
          title="Vice President, Operations"
          widgetType="none"
          onActivate={cycleTheme}
        />
      </div>
      <div className={styles.completedWrap}>
        <CornerInfoCard
          name={`Completed Today: ${completedToday.toLocaleString()}`}
          title="NOVA tickets"
          loading={completedTodayLoading}
          widgetType="none"
        />
      </div>
      <div className={styles.clockWrap}>
        <CornerInfoCard
          name={timeLabel}
          title={dateLabel}
          widgetType="none"
        />
      </div>
      {(assignedTicketsLoading || assignedTickets.length > 0) && (
        <div className={styles.assignedWrap}>
          <AssignedTicketsCornerCard
            title="Assigned Tickets"
            tickets={assignedTickets}
            loading={assignedTicketsLoading}
          />
        </div>
      )}
    </div>
  );
};
