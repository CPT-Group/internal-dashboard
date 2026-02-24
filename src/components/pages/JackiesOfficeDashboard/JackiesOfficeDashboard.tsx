'use client';

import { BackgroundSlideshow, CornerInfoCard } from '@/components/ui';
import { JACKIES_BACKGROUND_SLIDES } from '@/constants';
import styles from './JackiesOfficeDashboard.module.css';

/**
 * Jackie's Office dashboard – rotating background from
 * public/backgrounds/jackies-cute-backgrounds/. Floating corner card with name/title.
 */
export const JackiesOfficeDashboard = () => {
  return (
    <div className={styles.jackiesDashboardContent}>
      <BackgroundSlideshow
        slides={JACKIES_BACKGROUND_SLIDES}
        intervalMs={6000}
        transitionDurationMs={1500}
        transition="fade"
      />
      <div className={styles.cornerWrap}>
        <CornerInfoCard
          name="Jackie"
          title="Vice President, Operations"
          widgetType="none"
        />
      </div>
    </div>
  );
};
