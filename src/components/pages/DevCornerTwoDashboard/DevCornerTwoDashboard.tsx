'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { LOADING_NOVA_DATA_PLEASE_WAIT } from '@/constants';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import { InProgressCardsSlide } from './InProgressCardsSlide';
import { RecentlyCompletedSlide } from './RecentlyCompletedSlide';
import { RequestedTicketsSlide } from './RequestedTicketsSlide';
// Re-enable when adding back to carousel: Today (close times by component), Dev load matrix
// import { DevLoadMatrixSlide } from './DevLoadMatrixSlide';
// import { TodayComponentVelocitySlide } from './TodayComponentVelocitySlide';
import { CompletedByDevSlide } from './CompletedByDevSlide';
import { GithubDeployStatusSlide } from './GithubDeployStatusSlide';
import styles from './DevCornerTwoDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;

/**
 * Dwell time per slide (ms). Order: In Progress → Recently Completed → Requested →
 * Completions by developer → GitHub deploy.
 * Slides 1–4: 25s; GitHub deploy: 300s (5 min).
 * (Today velocity + Dev load matrix slides are commented out below — same index order when restored.)
 */
const SLIDE_DURATIONS_MS = [25_000, 25_000, 25_000, 25_000, 300_000] as const;
const NUM_SLIDES = SLIDE_DURATIONS_MS.length;

/** Set to a 0-based index to pin the carousel for local UI work; `null` = auto-advance. GitHub deploy = index `4`. */
const DEV_CORNER_TWO_FIXED_SLIDE_INDEX: number | null = null;

const IS_CAROUSEL_LOCKED =
  DEV_CORNER_TWO_FIXED_SLIDE_INDEX !== null &&
  DEV_CORNER_TWO_FIXED_SLIDE_INDEX >= 0 &&
  DEV_CORNER_TWO_FIXED_SLIDE_INDEX < NUM_SLIDES;

export const DevCornerTwoDashboard = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } =
    useOperationalJiraStore();

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
    if (IS_CAROUSEL_LOCKED) return;
    const ms = SLIDE_DURATIONS_MS[activeSlide];
    const t = window.setTimeout(() => {
      setLeavingSlide(activeRef.current);
      setActiveSlide((i) => (i + 1) % NUM_SLIDES);
    }, ms);
    return () => window.clearTimeout(t);
  }, [activeSlide]);

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
    todayComponentVelocity,
    completedByDeveloper,
    devLoadMatrix,
    assignees,
    components,
  } = analytics;

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'In Progress', value: inProgressTickets.length },
    { label: 'Completed (7d)', value: recentlyCompleted.length },
    { label: 'Requested', value: requestedTickets.length, severity: requestedTickets.length > 10 ? 'warning' : undefined },
    { label: 'Open (Prod)', value: kpis.openProd },
    { label: 'Open (NOVA)', value: kpis.openNova },
  ], [kpis, inProgressTickets.length, recentlyCompleted.length, requestedTickets.length]);

  const visibleSlide = IS_CAROUSEL_LOCKED ? lockedIndex! : activeSlide;

  const slideClass = (idx: number) =>
    `${styles.slide} ${visibleSlide === idx ? styles.active : ''} ${!IS_CAROUSEL_LOCKED && leavingSlide === idx ? styles.leaving : ''}`;

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingWrap} role="status" aria-live="polite" aria-busy="true">
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

  return (
    <div className={styles.dashboard}>
      <div className={styles.kpiRow}>
        <KpiStrip items={kpiItems} />
      </div>
      <div className={styles.carousel}>
        <div className={slideClass(0)}>
          <InProgressCardsSlide tickets={inProgressTickets} />
        </div>
        <div className={slideClass(1)}>
          <RecentlyCompletedSlide tickets={recentlyCompleted} />
        </div>
        <div className={slideClass(2)}>
          <RequestedTicketsSlide tickets={requestedTickets} />
        </div>
        {/*
          Restore: uncomment imports; add todayComponentVelocity, devLoadMatrix, assignees, components
          to the analytics destructure; insert these two slides after Requested (indices 3–4), renumber
          CompletedByDev → 5, GitHub → 6; extend SLIDE_DURATIONS_MS (e.g. 25s×6 + 300s for GitHub).
        <div className={slideClass(3)}>
          <TodayComponentVelocitySlide rows={todayComponentVelocity} />
        </div>
        <div className={slideClass(4)}>
          <DevLoadMatrixSlide matrix={devLoadMatrix} assignees={assignees} components={components} />
        </div>
        */}
        <div className={slideClass(3)}>
          <div className={styles.slideContent}>
            <CompletedByDevSlide columns={completedByDeveloper} />
          </div>
        </div>
        <div className={slideClass(4)}>
          <GithubDeployStatusSlide />
        </div>
        {!IS_CAROUSEL_LOCKED && (
          <div className={styles.indicators}>
            {Array.from({ length: NUM_SLIDES }, (_, i) => (
              <div key={i} className={`${styles.dot} ${visibleSlide === i ? styles.activeDot : ''}`} aria-hidden />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
