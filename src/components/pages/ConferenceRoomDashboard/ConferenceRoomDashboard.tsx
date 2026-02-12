'use client';

import { useEffect, useState } from 'react';
import { TextScroller } from '@/components/ui';
import {
  CONFERENCE_REEL_TEXT,
  CONFERENCE_BACKGROUND_SLIDES,
} from '@/constants';
import styles from './ConferenceRoomDashboard.module.css';

const SLIDE_INTERVAL_MS = 6000;
const FADE_DURATION_MS = 1500;

export const ConferenceRoomDashboard = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CONFERENCE_BACKGROUND_SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="conference-dashboard-content">
      <div className={styles.bgSlideshow} aria-hidden>
        {CONFERENCE_BACKGROUND_SLIDES.map((src, index) => (
          <div
            key={src}
            className={`${styles.bgSlide} ${index === currentIndex ? styles.active : ''}`}
            style={{
              backgroundImage: `url(${src})`,
              transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
            }}
          />
        ))}
      </div>
      <div className={styles.scrollerWrap}>
        <TextScroller duration={40}>
          <span className="text-color-secondary">{CONFERENCE_REEL_TEXT}</span>
        </TextScroller>
      </div>
    </div>
  );
};
