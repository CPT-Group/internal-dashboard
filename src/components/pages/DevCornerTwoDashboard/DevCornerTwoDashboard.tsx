'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { LOADING_NOVA_DATA_PLEASE_WAIT } from '@/constants';
import { useOperationalJiraStore } from '@/stores';
import { InProgressCardsSlide } from './InProgressCardsSlide';
import { RecentlyCompletedSlide } from './RecentlyCompletedSlide';
import { RequestedTicketsSlide } from './RequestedTicketsSlide';
// Re-enable when adding back to carousel: Today (close times by component), Dev load matrix
// import { DevLoadMatrixSlide } from './DevLoadMatrixSlide';
// import { TodayComponentVelocitySlide } from './TodayComponentVelocitySlide';
import { CompletedByDevSlide } from './CompletedByDevSlide';
import { GithubDeployStatusSlide } from './GithubDeployStatusSlide';
import { DEV_CORNER_TWO_SLIDE_TOGGLES } from './devCornerTwoSlides.config';
import type { DevCornerTwoSlideId } from './devCornerTwoSlides.config';
import styles from './DevCornerTwoDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

/** Set to a 0-based index into **enabled** slides only, e.g. `0` when only GitHub is on; `null` = auto-advance. */
const DEV_CORNER_TWO_FIXED_SLIDE_INDEX: number | null = null;

export const DevCornerTwoDashboard = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } =
    useOperationalJiraStore();

  const { enabledSlides, slideDurations, numSlides } = useMemo(() => {
    const enabled = DEV_CORNER_TWO_SLIDE_TOGGLES.filter((s) => s.enabled);
    return {
      enabledSlides: enabled,
      slideDurations: enabled.map((s) => s.durationMs),
      numSlides: enabled.length,
    };
  }, []);

  const IS_CAROUSEL_LOCKED =
    DEV_CORNER_TWO_FIXED_SLIDE_INDEX !== null &&
    DEV_CORNER_TWO_FIXED_SLIDE_INDEX >= 0 &&
    DEV_CORNER_TWO_FIXED_SLIDE_INDEX < numSlides;

  const lockedIndex = IS_CAROUSEL_LOCKED ? DEV_CORNER_TWO_FIXED_SLIDE_INDEX! : null;

  const [activeSlide, setActiveSlide] = useState(IS_CAROUSEL_LOCKED ? lockedIndex! : 0);
  const [leavingSlide, setLeavingSlide] = useState<number | null>(null);
  const activeRef = useRef(0);
  activeRef.current = IS_CAROUSEL_LOCKED ? lockedIndex! : activeSlide;

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOperationalData, isStale]);

  useEffect(() => {
    if (IS_CAROUSEL_LOCKED || numSlides === 0) return;
    const ms = slideDurations[activeSlide] ?? slideDurations[0];
    const t = window.setTimeout(() => {
      setLeavingSlide(activeRef.current);
      setActiveSlide((i) => (i + 1) % numSlides);
    }, ms);
    return () => window.clearTimeout(t);
  }, [activeSlide, IS_CAROUSEL_LOCKED, numSlides, slideDurations]);

  useEffect(() => {
    if (IS_CAROUSEL_LOCKED) return;
    if (leavingSlide === null) return;
    const t = setTimeout(() => setLeavingSlide(null), 600);
    return () => clearTimeout(t);
  }, [leavingSlide]);

  const analytics = getAnalytics();
  const {
    kpis,
    inProgressTickets,
    recentlyCompleted,
    requestedTickets,
    completedByDeveloper,
  } = analytics;

  const visibleSlide = IS_CAROUSEL_LOCKED ? lockedIndex! : activeSlide;

  const slideClass = (idx: number, slideId: DevCornerTwoSlideId) =>
    `${styles.slide} ${slideId === 'github' ? styles.slideGithubDeploy : ''} ${visibleSlide === idx ? styles.active : ''} ${!IS_CAROUSEL_LOCKED && leavingSlide === idx ? styles.leaving : ''}`;

  const renderSlide = (id: DevCornerTwoSlideId) => {
    switch (id) {
      case 'inProgress':
        return <InProgressCardsSlide tickets={inProgressTickets} />;
      case 'recentlyCompleted':
        return <RecentlyCompletedSlide tickets={recentlyCompleted} />;
      case 'requested':
        return <RequestedTicketsSlide tickets={requestedTickets} />;
      case 'completedByDev':
        return (
          <div className={styles.slideContent}>
            <CompletedByDevSlide columns={completedByDeveloper} />
          </div>
        );
      case 'github':
        return <GithubDeployStatusSlide />;
      default:
        return null;
    }
  };

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div
          className={`${styles.loadingWrap} ${styles.loadingOverlay}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <ProgressSpinner aria-hidden />
          <span>{LOADING_NOVA_DATA_PLEASE_WAIT}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <Message severity="error" text={error} className="w-full m-2" />
      </div>
    );
  }

  if (numSlides === 0) {
    return (
      <div className={styles.dashboard}>
        <Message
          severity="warn"
          text="No Dev Corner Two slides are enabled. Turn on at least one slide in devCornerTwoSlides.config.ts."
          className="w-full m-2"
        />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.carousel}>
        {enabledSlides.map((slide, idx) => (
          <div key={slide.id} className={slideClass(idx, slide.id)}>
            {renderSlide(slide.id)}
          </div>
        ))}
        {!IS_CAROUSEL_LOCKED && (
          <div className={styles.indicators}>
            {Array.from({ length: numSlides }, (_, i) => (
              <div key={i} className={`${styles.dot} ${visibleSlide === i ? styles.activeDot : ''}`} aria-hidden />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
