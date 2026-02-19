'use client';

import { BackgroundSlideshow } from '@/components/ui';
import { JULIES_BACKGROUND_SLIDES } from '@/constants';
import styles from './JuliesOfficeDashboard.module.css';

/**
 * Julie's Office dashboard – rotating unicorn-themed background from
 * public/JuliesUnicorns/backgrounds/. Content (scroller, widgets) can be added later.
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
    </div>
  );
};
