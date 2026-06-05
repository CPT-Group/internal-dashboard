'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchWorkHoursToday } from '@/services/api/jiraSearchClient';
import { NOVA_CORE_DEVS } from '@/constants';

const CORE_DEV_IDS = NOVA_CORE_DEVS.map((d) => d.accountId);

/** Poll every 10 minutes — worklogs change as devs log time. */
const POLL_MS = 10 * 60 * 1000;

/**
 * Fetches work hours logged today (Pacific time) for the 4 core devs.
 * Returns author totals plus issue-level breakdown for those same worklogs.
 */
export function useWorkHoursToday() {
  const [hours, setHours] = useState<Map<string, number>>(new Map());
  const [hoursByIssue, setHoursByIssue] = useState<Map<string, Map<string, number>>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchWorkHoursToday(CORE_DEV_IDS);
      setHours(result.byAuthorSeconds);
      setHoursByIssue(result.byIssueByAuthorSeconds);
    } catch (err) {
      console.error('Failed to fetch work hours:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { hours, hoursByIssue, loading };
}
