import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics } from '@/types';
import { buildAnalyticsFromIssueList } from '@/utils/jiraAnalytics';
import { jiraSearch } from '@/services/api/jiraSearchClient';
import {
  JIRA_CACHE_TTL_MS,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_TREVOR_JQL,
  JIRA_TREVOR_JQL_OPEN,
  TREVOR_TEAM_ACCOUNT_IDS,
} from '@/constants';

function isTrevorTeamIssue(issue: JiraIssue): boolean {
  const id = issue.fields?.assignee?.accountId;
  return id != null && TREVOR_TEAM_ACCOUNT_IDS.has(id);
}

interface TrevorJiraState {
  issues: JiraIssue[];
  openCountFromJira: number | null;
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  fetchTrevorData: (force?: boolean) => Promise<void>;
  getAnalytics: () => NovaAnalytics;
  getAllIssues: () => JiraIssue[];
  isStale: () => boolean;
}

export const useTrevorJiraStore = create<TrevorJiraState>((set, get) => ({
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

  fetchTrevorData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [listResult, openResult] = await Promise.all([
        jiraSearch(JIRA_TREVOR_JQL, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_TREVOR_JQL_OPEN, 1),
      ]);
      set({
        issues: listResult.issues,
        openCountFromJira: openResult.total,
        lastFetched: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Trevor data';
      set({ loading: false, error: message });
    }
  },

  getAnalytics: () => {
    const { issues, openCountFromJira } = get();
    return buildAnalyticsFromIssueList({
      issues,
      filterByAccountIds: TREVOR_TEAM_ACCOUNT_IDS,
      openCountOverride: openCountFromJira,
    });
  },

  getAllIssues: () => get().issues.filter(isTrevorTeamIssue),
}));
