'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JiraIssue } from '@/types';
import { fetchUpdates } from '@/services/api/endpoints/jira';

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface UseJiraUpdatesPollingOptions {
  /** Poll interval in ms. Default 30 minutes. */
  intervalMs?: number;
  /** If true, start polling when mounted. Default true. */
  enabled?: boolean;
  /** Called each time new updates are fetched (e.g. to merge into a store or show a toast). */
  onUpdates?: (issues: JiraIssue[], fetchedAt: Date) => void;
}

export interface UseJiraUpdatesPollingResult {
  /** Issues returned from the most recent fetch (updated since previous check). */
  lastUpdates: JiraIssue[];
  /** Timestamp of the last successful fetch. */
  lastFetchedAt: Date | null;
  /** True while a fetch is in progress. */
  loading: boolean;
  /** Error message from the last failed fetch. */
  error: string | null;
  /** Manually trigger a fetch now (uses current lastFetchedAt as "since"). */
  refetch: () => Promise<void>;
}

/**
 * Poll Jira every N minutes for tickets updated since the last check.
 * First run uses "since = now - interval" so the first result is roughly the last interval's updates.
 * Then each run uses the previous fetch time as "since" and sets lastFetchedAt for the next run.
 */
export function useJiraUpdatesPolling(
  options: UseJiraUpdatesPollingOptions = {}
): UseJiraUpdatesPollingResult {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    enabled = true,
    onUpdates,
  } = options;

  const [lastUpdates, setLastUpdates] = useState<JiraIssue[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sinceRef = useRef<Date>(new Date(Date.now() - intervalMs));

  const runFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUpdates(sinceRef.current);
      sinceRef.current = result.fetchedAt;
      setLastUpdates(result.issues);
      setLastFetchedAt(result.fetchedAt);
      onUpdates?.(result.issues, result.fetchedAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Jira updates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [onUpdates]);

  useEffect(() => {
    if (!enabled) return;

    void runFetch();

    const id = setInterval(() => {
      void runFetch();
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, intervalMs, runFetch]);

  return {
    lastUpdates,
    lastFetchedAt,
    loading,
    error,
    refetch: runFetch,
  };
}
