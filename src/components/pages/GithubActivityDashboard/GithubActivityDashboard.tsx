'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useAutoScroll, usePageAutoRefresh } from '@/hooks';
import { GITHUB_ACTIVITY_POLL_INTERVAL_MS, getPageReloadInterval } from '@/constants';
import type { GitHubWebhookEventRecord } from '@/types';
import styles from './GithubActivityDashboard.module.scss';

/** Slides 0–2: 30s each; slide 3 (feed): 120s. */
const SLIDE_DURATIONS_MS = [30_000, 30_000, 30_000, 120_000] as const;
const NUM_SLIDES = SLIDE_DURATIONS_MS.length;

export const GithubActivityDashboard = () => {
  usePageAutoRefresh(getPageReloadInterval());

  const [events, setEvents] = useState<GitHubWebhookEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [leavingSlide, setLeavingSlide] = useState<number | null>(null);
  const activeRef = useRef(0);
  activeRef.current = activeSlide;

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks/github');
      const data = (await res.json()) as { ok?: boolean; events?: GitHubWebhookEventRecord[] };
      if (!res.ok) {
        setError('Failed to load webhook cache');
        return;
      }
      setError(null);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
    const id = window.setInterval(() => void fetchEvents(), GITHUB_ACTIVITY_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchEvents]);

  useEffect(() => {
    const ms = SLIDE_DURATIONS_MS[activeSlide];
    const t = window.setTimeout(() => {
      setLeavingSlide(activeRef.current);
      setActiveSlide((i) => (i + 1) % NUM_SLIDES);
    }, ms);
    return () => window.clearTimeout(t);
  }, [activeSlide]);

  useEffect(() => {
    if (leavingSlide === null) return;
    const t = setTimeout(() => setLeavingSlide(null), 600);
    return () => clearTimeout(t);
  }, [leavingSlide]);

  const feedScrollRef = useAutoScroll<HTMLDivElement>({ pixelsPerSecond: 8, pauseMs: 5000 });

  const slideClass = (idx: number) =>
    `${styles.slide} ${activeSlide === idx ? styles.active : ''} ${leavingSlide === idx ? styles.leaving : ''}`;

  if (loading && events.length === 0 && !error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>
          <ProgressSpinner />
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={styles.dashboard}>
        <Message severity="error" text={error} className="w-full m-2" />
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>GitHub · CPT Group</span>
        <span className={styles.headerMeta}>
          {events.length} event{events.length === 1 ? '' : 's'} cached · poll{' '}
          {GITHUB_ACTIVITY_POLL_INTERVAL_MS / 1000}s
        </span>
      </header>
      <div className={styles.carousel}>
        <div className={slideClass(0)}>
          <div className={styles.slideInner}>
            <div className={styles.slideTitle}>Overview</div>
            <div className={styles.slideBody}>
              Webhook deliveries appear on the last slide (2 min). This dashboard polls the same API your
              GitHub webhook POSTs to — no duplicate GitHub API usage.
            </div>
          </div>
        </div>
        <div className={slideClass(1)}>
          <div className={styles.slideInner}>
            <div className={styles.slideTitle}>Configure GitHub</div>
            <div className={styles.slideBody}>
              In repo or org Settings → Webhooks: Payload URL must be your deployed site plus
              /api/webhooks/github — not the Teams URL. Set a secret and add GITHUB_WEBHOOK_SECRET to the
              server env. Optional: GITHUB_WEBHOOK_CPT_GROUP for Teams mirror (incoming webhook URL).
            </div>
          </div>
        </div>
        <div className={slideClass(2)}>
          <div className={styles.slideInner}>
            <div className={styles.slideTitle}>Activity</div>
            <div className={styles.slideBody}>
              Latest deliveries (newest first). Cache: last {events.length} kept in memory on this server
              instance (serverless: may reset on cold start).
            </div>
          </div>
        </div>
        <div className={slideClass(3)}>
          <div className={styles.slideInner}>
            <div className={styles.slideTitle}>Recent deliveries (2 min on this slide)</div>
            <div ref={feedScrollRef} className={styles.feedScroll}>
              {events.length === 0 ? (
                <div className={styles.slideBody}>No webhook deliveries yet. Send a test delivery from GitHub.</div>
              ) : (
                <div className={styles.feedList}>
                  {events.map((e) => (
                    <div key={e.deliveryId} className={styles.feedRow}>
                      <div className={styles.feedTime}>
                        {e.receivedAt.slice(0, 19).replace('T', ' ')} · {e.event}
                      </div>
                      <div>{e.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
