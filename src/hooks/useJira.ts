'use client';

import { useCallback, useState } from 'react';
import type { JiraSearchParams, JiraSearchResponse } from '@/types';

interface JiraMyselfResponse {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

interface UseJiraReturn {
  /** Search issues by JQL (e.g. project = NOVA). */
  searchIssues: (params: JiraSearchParams) => Promise<JiraSearchResponse>;
  /** Verify Jira credentials – returns current user. */
  getMyself: () => Promise<JiraMyselfResponse>;
  /** Last search result. */
  searchResult: JiraSearchResponse | null;
  /** Last search error message. */
  searchError: string | null;
  /** True while a search request is in flight. */
  searchLoading: boolean;
  /** Current user from getMyself(). */
  myself: JiraMyselfResponse | null;
  /** Error from getMyself(). */
  myselfError: string | null;
  /** True while getMyself request is in flight. */
  myselfLoading: boolean;
}

export function useJira(): UseJiraReturn {
  const [searchResult, setSearchResult] = useState<JiraSearchResponse | null>(
    null
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [myself, setMyself] = useState<JiraMyselfResponse | null>(null);
  const [myselfError, setMyselfError] = useState<string | null>(null);
  const [myselfLoading, setMyselfLoading] = useState(false);

  const searchIssues = useCallback(async (params: JiraSearchParams) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const q = new URLSearchParams();
      q.set('jql', params.jql);
      if (params.maxResults != null) q.set('maxResults', String(params.maxResults));
      if (params.startAt != null) q.set('startAt', String(params.startAt));
      const res = await fetch(`/api/jira/search?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message ?? `HTTP ${res.status}`;
        setSearchError(msg);
        throw new Error(msg);
      }
      const data = json as JiraSearchResponse & { success: boolean };
      const result: JiraSearchResponse = {
        startAt: data.startAt,
        maxResults: data.maxResults,
        total: data.total,
        issues: data.issues ?? [],
      };
      setSearchResult(result);
      return result;
    } catch (err) {
      if (err instanceof Error) setSearchError(err.message);
      throw err;
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const getMyself = useCallback(async () => {
    setMyselfLoading(true);
    setMyselfError(null);
    try {
      const res = await fetch('/api/jira/myself');
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message ?? `HTTP ${res.status}`;
        setMyselfError(msg);
        throw new Error(msg);
      }
      const data = json as JiraMyselfResponse & { success: boolean };
      const user: JiraMyselfResponse = {
        accountId: data.accountId,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
      };
      setMyself(user);
      return user;
    } catch (err) {
      if (err instanceof Error) setMyselfError(err.message);
      throw err;
    } finally {
      setMyselfLoading(false);
    }
  }, []);

  return {
    searchIssues,
    getMyself,
    searchResult,
    searchError,
    searchLoading,
    myself,
    myselfError,
    myselfLoading,
  };
}
