'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JULIES_BACKGROUND_SLIDES } from '@/constants';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './JuliesOfficeDashboard.module.css';

/**
 * Julie's Office dashboard – rotating unicorn-themed background from
 * public/backgrounds/julies-unicorns/. Floating corner card with name/title; widgetType supports weather/cpt later.
 */
export const JuliesOfficeDashboard = () => {
  const { cycleTheme } = useTheme();

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
    </div>
  );
};
