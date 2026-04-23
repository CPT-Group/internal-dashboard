'use client';

import { useEffect } from 'react';
import { useOperationalJiraStore } from '@/stores';

const POLL_INTERVAL_MS = 60_000;

/**
 * Lightweight shared hook for "Completed Today" KPI in non-Dev dashboards.
 * Reuses `operationalJiraStore` (same source as Dev Corner cards) so numbers stay aligned.
 */
export const useCompletedTodayCount = () => {
  const { fetchOperationalData, isStale, loading, error, getAnalytics } = useOperationalJiraStore();

  useEffect(() => {
    if (isStale()) void fetchOperationalData();
    const interval = setInterval(() => {
      if (isStale()) void fetchOperationalData();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOperationalData, isStale]);

  return {
    completedToday: getAnalytics().kpis.closedToday,
    loading,
    error,
  };
};

