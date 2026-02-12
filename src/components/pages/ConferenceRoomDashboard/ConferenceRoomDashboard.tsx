'use client';

import { TextScroller } from '@/components/ui';
import { CONFERENCE_REEL_TEXT } from '@/constants';

export const ConferenceRoomDashboard = () => {
  return (
    <div className="conference-dashboard-content">
      <div className="conference-dashboard-scroller-wrap">
        <TextScroller duration={40}>
          <span className="text-color-secondary">{CONFERENCE_REEL_TEXT}</span>
        </TextScroller>
      </div>
    </div>
  );
};
