'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JULIES_BACKGROUND_SLIDES } from '@/constants';
import { useCompletedTodayCount, useSyncedClock } from '@/hooks';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './JuliesOfficeDashboard.module.css';

/**
 * Julie's Office dashboard – rotating unicorn-themed background from
 * public/backgrounds/julies-unicorns/. Floating corner card with name/title; widgetType supports weather/cpt later.
 */
export const JuliesOfficeDashboard = () => {
  const { cycleTheme } = useTheme();
  const { completedToday, loading: completedTodayLoading } = useCompletedTodayCount();
  const { timeLabel, dateLabel } = useSyncedClock();

  return (
    <div className={styles.juliesDashboardContent}>
      <BackgroundSlideshow
        slides={JULIES_BACKGROUND_SLIDES}
        intervalMs={60000}
        transitionDurationMs={2500}
        transition="fade"
      />
      <div className={styles.cornerWrap}>
        <CornerInfoCard
          name="Julie Green"
          title="CPT President & Unicorn Expert"
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
