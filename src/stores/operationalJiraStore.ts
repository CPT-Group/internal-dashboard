import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { OperationalAnalytics } from '@/types';
import { buildOperationalAnalytics } from '@/utils/operationalAnalytics';
import { jiraSearch, jiraTransitionDates } from '@/services/api/jiraSearchClient';
import {
  JIRA_CACHE_TTL_MS,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_OPERATIONAL_JQL_OPEN,
  JIRA_OPERATIONAL_JQL_LANDED_TODAY,
  JIRA_OPERATIONAL_JQL_CLOSED_TODAY,
  JIRA_OPERATIONAL_JQL_LANDED_LAST_14,
  JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14,
  JIRA_OPERATIONAL_JQL_LANDED_PREV_14,
  JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14,
} from '@/constants';
import { filterIssuesNovaMinKey } from '@/utils/jiraNovaFilter';

interface OperationalJiraState {
  openIssues: JiraIssue[];
  landedToday: JiraIssue[];
  closedToday: JiraIssue[];
  landedLast14: JiraIssue[];
  resolvedLast14: JiraIssue[];
  landedPrev14: JiraIssue[];
  resolvedPrev14: JiraIssue[];
  /** Map of issueKey → ISO date when the issue transitioned FROM "New". */
  transitionDates: Map<string, string>;
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
  landedLast14: [],
  resolvedLast14: [],
  transitionDates: new Map(),
});

export const useOperationalJiraStore = create<OperationalJiraState>((set, get) => ({
  openIssues: [],
  landedToday: [],
  closedToday: [],
  landedLast14: [],
  resolvedLast14: [],
  landedPrev14: [],
  resolvedPrev14: [],
  transitionDates: new Map(),
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
      const [open, landedToday, closedToday, landedLast14, resolvedLast14, landedPrev14, resolvedPrev14] = await Promise.all([
        jiraSearch(JIRA_OPERATIONAL_JQL_OPEN, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_CLOSED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_PREV_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14, JIRA_SEARCH_MAX_RESULTS),
      ]);
      const filterNova = (issues: JiraIssue[]) => filterIssuesNovaMinKey(issues);
      const openFiltered = filterNova(open.issues);
      const landedTodayFiltered = filterNova(landedToday.issues);
      const closedTodayFiltered = filterNova(closedToday.issues);
      const landedLast14Filtered = filterNova(landedLast14.issues);
      const resolvedLast14Filtered = filterNova(resolvedLast14.issues);
      const landedPrev14Filtered = filterNova(landedPrev14.issues);
      const resolvedPrev14Filtered = filterNova(resolvedPrev14.issues);

      // For CM/OPRD issues in the 14d window, fetch exact transition dates.
      // NOVA issues use `created` as their "landed" date (no "New" status).
      const cmOprdKeys = landedLast14Filtered
        .filter((i) => i.fields?.project?.key !== 'NOVA')
        .map((i) => i.key);
      const transitionDates = cmOprdKeys.length > 0
        ? await jiraTransitionDates(cmOprdKeys)
        : new Map<string, string>();

      const analytics = buildOperationalAnalytics({
        openIssues: openFiltered,
        openedTodayIssues: landedTodayFiltered,
        closedTodayIssues: closedTodayFiltered,
        landedLast14: landedLast14Filtered,
        resolvedLast14: resolvedLast14Filtered,
        landedPrev14: landedPrev14Filtered,
        resolvedPrev14: resolvedPrev14Filtered,
        transitionDates,
      });
      set({
        openIssues: openFiltered,
        landedToday: landedTodayFiltered,
        closedToday: closedTodayFiltered,
        landedLast14: landedLast14Filtered,
        resolvedLast14: resolvedLast14Filtered,
        landedPrev14: landedPrev14Filtered,
        resolvedPrev14: resolvedPrev14Filtered,
        transitionDates,
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
