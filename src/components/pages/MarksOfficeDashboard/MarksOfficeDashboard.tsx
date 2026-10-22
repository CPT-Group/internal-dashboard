'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { MARKS_BACKGROUND_SLIDES } from '@/constants';
import { useCompletedTodayCount, useSyncedClock } from '@/hooks';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './MarksOfficeDashboard.module.css';

/**
 * Mark's Office dashboard – rotating finance-themed background from
 * public/backgrounds/marks-finance-backgrounds/. Floating corner card with name/title.
 * Mark (CFO) has no Jira account, so this omits the Assigned Tickets corner card
 * that Jackie's/Julie's dashboards show (unlike those two, no top-left panel).
 */
export const MarksOfficeDashboard = () => {
  const { cycleTheme } = useTheme();
  const { completedToday, loading: completedTodayLoading } = useCompletedTodayCount();
  const { timeLabel, dateLabel } = useSyncedClock();

  return (
    <div className={styles.marksDashboardContent}>
      <BackgroundSlideshow
        slides={MARKS_BACKGROUND_SLIDES}
        intervalMs={60000}
        transitionDurationMs={2500}
        transition="fade"
      />
      <div className={styles.cornerWrap}>
        <CornerInfoCard
          name="Mark Brandenberger"
          title="Chief Financial Officer"
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
    </div>
  );
};
