'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JULIES_BACKGROUND_SLIDES } from '@/constants';
import styles from './JuliesOfficeDashboard.module.css';

/**
 * Julie's Office dashboard – rotating unicorn-themed background from
 * public/backgrounds/julies-unicorns/. Floating corner card with name/title; widgetType supports weather/cpt later.
 */
export const JuliesOfficeDashboard = () => {
  return (
    <div className={styles.juliesDashboardContent}>
      <BackgroundSlideshow
        slides={JULIES_BACKGROUND_SLIDES}
        intervalMs={6000}
        transitionDurationMs={1500}
        transition="fade"
      />
      <div className={styles.cornerWrap}>
        <CornerInfoCard
          name="Julie Green"
          title="CPT President & Unicorn Expert"
          widgetType="none"
        />
      </div>
    </div>
  );
};
