import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { OperationalAnalytics } from '@/types';
import { buildOperationalAnalytics } from '@/utils/operationalAnalytics';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import {
  JIRA_CACHE_TTL_MS,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_OPERATIONAL_JQL_OPEN,
  JIRA_OPERATIONAL_JQL_OPENED_TODAY,
  JIRA_OPERATIONAL_JQL_CLOSED_TODAY,
  JIRA_OPERATIONAL_JQL_CREATED_LAST_14,
  JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14,
} from '@/constants';

interface OperationalJiraState {
  openIssues: JiraIssue[];
  openedToday: JiraIssue[];
  closedToday: JiraIssue[];
  createdLast14: JiraIssue[];
  resolvedLast14: JiraIssue[];
  analytics: OperationalAnalytics;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  getAnalytics: () => OperationalAnalytics;
  fetchOperationalData: (force?: boolean) => Promise<void>;
  isStale: () => boolean;
}

const emptyAnalytics = buildOperationalAnalytics({
  openIssues: [],
  openedTodayIssues: [],
  closedTodayIssues: [],
  createdLast14: [],
  resolvedLast14: [],
});

export const useOperationalJiraStore = create<OperationalJiraState>((set, get) => ({
  openIssues: [],
  openedToday: [],
  closedToday: [],
  createdLast14: [],
  resolvedLast14: [],
  analytics: emptyAnalytics,
  loading: false,
  error: null,
  lastFetched: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > JIRA_CACHE_TTL_MS;
  },

  fetchOperationalData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [open, openedToday, closedToday, createdLast14, resolvedLast14] = await Promise.all([
        jiraSearch(JIRA_OPERATIONAL_JQL_OPEN, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_OPENED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_CLOSED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_CREATED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
      ]);
      const analytics = buildOperationalAnalytics({
        openIssues: open.issues,
        openedTodayIssues: openedToday.issues,
        closedTodayIssues: closedToday.issues,
        createdLast14: createdLast14.issues,
        resolvedLast14: resolvedLast14.issues,
      });
      set({
        openIssues: open.issues,
        openedToday: openedToday.issues,
        closedToday: closedToday.issues,
        createdLast14: createdLast14.issues,
        resolvedLast14: resolvedLast14.issues,
        analytics,
        lastFetched: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch operational Jira data';
      set({ loading: false, error: message });
    }
  },

  getAnalytics: () => get().analytics,
}));
