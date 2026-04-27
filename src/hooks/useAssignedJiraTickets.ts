'use client';

import { useEffect, useMemo, useState } from 'react';
import { jiraSearch } from '@/services/api/jiraSearchClient';

const POLL_INTERVAL_MS = 60_000;

export interface AssignedJiraTicket {
  key: string;
  summary: string;
  component: string | null;
  statusName: string;
  ticketUrl: string;
}

export interface UseAssignedJiraTicketsResult {
  tickets: AssignedJiraTicket[];
  loading: boolean;
  error: string | null;
}

/**
 * Lightweight assignee-scoped active ticket list for office corner dashboards.
 * Excludes done + backlog, and refreshes on a simple interval for TV usage.
 */
export function useAssignedJiraTickets(accountId: string): UseAssignedJiraTicketsResult {
  const [tickets, setTickets] = useState<AssignedJiraTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const jql = useMemo(
    () =>
      `assignee = "${accountId}" AND statusCategory != Done AND status != Backlog ORDER BY updated DESC`,
    [accountId]
  );

  useEffect(() => {
    let isMounted = true;

    const fetchTickets = async () => {
      try {
        setError(null);
        const result = await jiraSearch(jql, 100);
        if (!isMounted) return;

        const mapped = result.issues
          .filter((issue) => issue.fields?.status?.statusCategory?.key !== 'done')
          .filter((issue) => issue.fields?.status?.name?.toLowerCase() !== 'backlog')
          .map((issue) => {
            const firstComponent = issue.fields.components?.[0]?.name?.trim();
            return {
              key: issue.key,
              summary: issue.fields.summary ?? '(no summary)',
              component: firstComponent && firstComponent.length > 0 ? firstComponent : null,
              statusName: issue.fields.status?.name ?? 'Unknown',
              ticketUrl: `https://cptgroup.atlassian.net/browse/${issue.key}`,
            } satisfies AssignedJiraTicket;
          });

        setTickets(mapped);
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchTickets();
    const interval = setInterval(() => {
      void fetchTickets();
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [jql]);

  return { tickets, loading, error };
}

