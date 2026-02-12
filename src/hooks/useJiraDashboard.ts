'use client';

import { useCallback } from 'react';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics } from '@/types';
import { useJiraNovaStore, useTrevorJiraStore } from '@/stores';

export type JiraDashboardKey = 'nova' | 'trevor';

export interface UseJiraDashboardReturn {
  analytics: NovaAnalytics;
  allIssues: JiraIssue[];
  loading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  isStale: () => boolean;
}

export function useJiraDashboard(key: JiraDashboardKey): UseJiraDashboardReturn {
  const nova = useJiraNovaStore();
  const trevor = useTrevorJiraStore();

  const refresh = useCallback(
    async (force = false) => {
      if (key === 'nova') return nova.fetchNovaData(force);
      return trevor.fetchTrevorData(force);
    },
    [key, nova.fetchNovaData, trevor.fetchTrevorData]
  );

  if (key === 'nova') {
    return {
      analytics: nova.getAnalytics(),
      allIssues: nova.getAllIssues(),
      loading: nova.loading,
      error: nova.error,
      refresh,
      isStale: nova.isStale,
    };
  }

  return {
    analytics: trevor.getAnalytics(),
    allIssues: trevor.getAllIssues(),
    loading: trevor.loading,
    error: trevor.error,
    refresh,
    isStale: trevor.isStale,
  };
}
