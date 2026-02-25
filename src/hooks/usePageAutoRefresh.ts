'use client';

import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Triggers a full page reload on a fixed interval.
 * Ensures clean state, clears memory leaks, and picks up deployed code changes.
 * Intended for always-on TV dashboards.
 */
export function usePageAutoRefresh(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const timer = setInterval(() => {
      window.location.reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
}
