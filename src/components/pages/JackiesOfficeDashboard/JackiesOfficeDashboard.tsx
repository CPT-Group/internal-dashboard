'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JACKIES_BACKGROUND_SLIDES } from '@/constants';
import { useCompletedTodayCount, useSyncedClock } from '@/hooks';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './JackiesOfficeDashboard.module.css';

/**
 * Jackie's Office dashboard – rotating background from
 * public/backgrounds/jackies-cute-backgrounds/. Floating corner card with name/title.
 */
export const JackiesOfficeDashboard = () => {
  const { cycleTheme } = useTheme();
  const { completedToday, loading: completedTodayLoading } = useCompletedTodayCount();
  const { timeLabel, timeZoneLabel } = useSyncedClock();

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
          title={timeZoneLabel}
          widgetType="none"
        />
      </div>
    </div>
  );
};
