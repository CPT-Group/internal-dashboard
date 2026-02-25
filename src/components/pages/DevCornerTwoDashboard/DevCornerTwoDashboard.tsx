'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useOperationalJiraStore } from '@/stores';
import { KpiStrip } from '@/components/ui';
import type { KpiItem } from '@/components/ui';
import {
  toBacklogByComponentBarChartData,
  toAgingBucketsBarChartData,
} from '@/utils/chartDataMappers';
import { InProgressCardsSlide } from './InProgressCardsSlide';
import { RecentlyCompletedSlide } from './RecentlyCompletedSlide';
import { BacklogAgingSlide } from './BacklogAgingSlide';
import { DevLoadMatrixSlide } from './DevLoadMatrixSlide';
import styles from './DevCornerTwoDashboard.module.scss';

const POLL_INTERVAL_MS = 60_000;
const SLIDE_DURATION_MS = 20_000;
const NUM_SLIDES = 4;

export const DevCornerTwoDashboard = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } =
    useOperationalJiraStore();

  const [activeSlide, setActiveSlide] = useState(0);
  const [leavingSlide, setLeavingSlide] = useState<number | null>(null);
  const activeRef = useRef(0);
  activeRef.current = activeSlide;

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOperationalData, isStale]);

  useEffect(() => {
    const t = setInterval(() => {
      setLeavingSlide(activeRef.current);
      setActiveSlide((i) => (i + 1) % NUM_SLIDES);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (leavingSlide === null) return;
    const t = setTimeout(() => setLeavingSlide(null), 600);
    return () => clearTimeout(t);
  }, [leavingSlide]);

  const analytics = getAnalytics();
  const { kpis, inProgressTickets, recentlyCompleted, devLoadMatrix, assignees, components } = analytics;

  const backlogData = useMemo(() => toBacklogByComponentBarChartData(analytics), [analytics]);
  const agingData = useMemo(() => toAgingBucketsBarChartData(analytics), [analytics]);

  const kpiItems: KpiItem[] = useMemo(() => [
    { label: 'In Progress', value: inProgressTickets.length },
    { label: 'Completed (7d)', value: recentlyCompleted.length },
    { label: 'Open', value: kpis.openCount },
    { label: 'Avg Age', value: `${kpis.avgAgeDays}d` },
    { label: 'Oldest', value: `${kpis.oldestAgeDays}d` },
  ], [kpis, inProgressTickets.length, recentlyCompleted.length]);

  const slideClass = (idx: number) =>
    `${styles.slide} ${activeSlide === idx ? styles.active : ''} ${leavingSlide === idx ? styles.leaving : ''}`;

  if (loading && kpis.openCount === 0) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingWrap}>
          <ProgressSpinner />
          <span>Loading...</span>
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
          <BacklogAgingSlide backlogData={backlogData} agingData={agingData} />
        </div>
        <div className={slideClass(3)}>
          <DevLoadMatrixSlide matrix={devLoadMatrix} assignees={assignees} components={components} />
        </div>
        <div className={styles.indicators}>
          {Array.from({ length: NUM_SLIDES }, (_, i) => (
            <div key={i} className={`${styles.dot} ${activeSlide === i ? styles.activeDot : ''}`} aria-hidden />
          ))}
        </div>
      </div>
    </div>
  );
};
