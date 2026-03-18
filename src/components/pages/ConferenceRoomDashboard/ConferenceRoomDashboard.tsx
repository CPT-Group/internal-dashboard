'use client';

import { TextScroller, BackgroundSlideshow } from '@/components/ui';
import { CONFERENCE_REEL_TEXT, CONFERENCE_BACKGROUND_SLIDES } from '@/constants';
import styles from './ConferenceRoomDashboard.module.css';

export const ConferenceRoomDashboard = () => {
  return (
    <div className="conference-dashboard-content">
      <BackgroundSlideshow
        slides={CONFERENCE_BACKGROUND_SLIDES}
        intervalMs={60000}
        transitionDurationMs={2500}
        transition="fade"
      />
      <div className={styles.scrollerWrap}>
        <TextScroller duration={40} textColor="white" backgroundColor="black">
          {CONFERENCE_REEL_TEXT}
        </TextScroller>
      </div>
    </div>
  );
};
