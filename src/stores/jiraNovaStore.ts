import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics } from '@/types';
import { buildAnalyticsFromNovaQueries } from '@/utils/jiraAnalytics';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import {
  JIRA_CACHE_TTL_MS,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_NOVA_JQL_TODAY,
  JIRA_NOVA_JQL_OPEN,
  JIRA_NOVA_JQL_OVERDUE,
  JIRA_NOVA_JQL_DONE,
} from '@/constants';

interface JiraNovaState {
  todayIssues: JiraIssue[];
  openIssues: JiraIssue[];
  overdueIssues: JiraIssue[];
  doneIssues: JiraIssue[];
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  fetchNovaData: (force?: boolean) => Promise<void>;
  getAnalytics: () => NovaAnalytics;
  getAllIssues: () => JiraIssue[];
  isStale: () => boolean;
}

export const useJiraNovaStore = create<JiraNovaState>((set, get) => ({
  todayIssues: [],
  openIssues: [],
  overdueIssues: [],
  doneIssues: [],
  lastFetched: null,
  loading: false,
  error: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > JIRA_CACHE_TTL_MS;
  },

  fetchNovaData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [todayRes, openRes, overdueRes, doneRes] = await Promise.all([
        jiraSearch(JIRA_NOVA_JQL_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_NOVA_JQL_OPEN, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_NOVA_JQL_OVERDUE, JIRA_SEARCH_MAX_RESULTS).catch(() => ({ issues: [] as JiraIssue[], total: 0 })),
        jiraSearch(JIRA_NOVA_JQL_DONE, JIRA_SEARCH_MAX_RESULTS).catch(() => ({ issues: [] as JiraIssue[], total: 0 })),
      ]);
      set({
        todayIssues: todayRes.issues,
        openIssues: openRes.issues,
        overdueIssues: overdueRes.issues,
        doneIssues: doneRes.issues,
        lastFetched: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch NOVA data';
      set({ loading: false, error: message });
    }
  },

  getAnalytics: () => {
    const { openIssues, todayIssues, overdueIssues, doneIssues } = get();
    return buildAnalyticsFromNovaQueries({
      openIssues,
      todayIssues,
      overdueIssues,
      doneIssues,
    });
  },

  getAllIssues: () => {
    const { openIssues, todayIssues, overdueIssues, doneIssues } = get();
    const byId = new Map<string, JiraIssue>();
    [...openIssues, ...todayIssues, ...overdueIssues, ...doneIssues].forEach(
      (i) => byId.set(i.id, i)
    );
    return Array.from(byId.values());
  },
}));
