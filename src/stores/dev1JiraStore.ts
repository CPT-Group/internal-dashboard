import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics } from '@/types';
import { buildAnalyticsFromIssueList } from '@/utils/jiraAnalytics';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import {
  JIRA_CACHE_TTL_MS,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_DEV1_JQL,
  JIRA_DEV1_JQL_OPEN,
} from '@/constants';
import { filterIssuesNovaMinKey } from '@/utils/jiraNovaFilter';

interface Dev1JiraState {
  issues: JiraIssue[];
  openCountFromJira: number | null;
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  fetchDev1Data: (force?: boolean) => Promise<void>;
  getAnalytics: () => NovaAnalytics;
  getAllIssues: () => JiraIssue[];
  isStale: () => boolean;
}

export const useDev1JiraStore = create<Dev1JiraState>((set, get) => ({
  issues: [],
  openCountFromJira: null,
  lastFetched: null,
  loading: false,
  error: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > JIRA_CACHE_TTL_MS;
  },

  fetchDev1Data: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [listResult, openResult] = await Promise.all([
        jiraSearch(JIRA_DEV1_JQL, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_DEV1_JQL_OPEN, 1),
      ]);
      const issuesFiltered = filterIssuesNovaMinKey(listResult.issues);
      set({
        issues: issuesFiltered,
        openCountFromJira: null,
        lastFetched: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Dev1 data';
      set({ loading: false, error: message });
    }
  },

  getAnalytics: () => {
    const { issues } = get();
    return buildAnalyticsFromIssueList({
      issues,
      openCountOverride: null,
    });
  },

  getAllIssues: () => get().issues,
}));
