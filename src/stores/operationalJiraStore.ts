import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { ImpedimentAnalytics, OperationalAnalytics } from '@/types';
import { buildOperationalAnalytics } from '@/utils/operationalAnalytics';
import { buildImpedimentAnalytics } from '@/utils/impedimentAnalytics';
import { jiraSearch, jiraTransitionDates } from '@/services/api/jiraSearchClient';
import {
  getJiraCacheTtl,
  JIRA_SEARCH_MAX_RESULTS,
  JIRA_IMPEDIMENT_LINK_CARRIERS_JQL,
  JIRA_IMPEDIMENT_SEARCH_FIELDS,
  JIRA_OPERATIONAL_JQL_OPEN,
  JIRA_OPERATIONAL_JQL_LIMBO,
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
  impedimentAnalytics: ImpedimentAnalytics;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  impedimentLastFetched: number | null;
  getAnalytics: () => OperationalAnalytics;
  fetchOperationalData: (force?: boolean) => Promise<void>;
  fetchImpedimentData: (force?: boolean) => Promise<void>;
  isStale: () => boolean;
  isImpedimentStale: () => boolean;
}

const emptyAnalytics = buildOperationalAnalytics({
  openIssues: [],
  openedTodayIssues: [],
  closedTodayIssues: [],
  landedLast14: [],
  resolvedLast14: [],
  transitionDates: new Map(),
});

const emptyImpedimentAnalytics = buildImpedimentAnalytics({
  openOperationalIssues: [],
  linkCarrierIssues: [],
});

const IMPEDIMENT_REFRESH_INTERVAL_MS = 60_000;

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
  impedimentAnalytics: emptyImpedimentAnalytics,
  loading: false,
  error: null,
  lastFetched: null,
  impedimentLastFetched: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > getJiraCacheTtl();
  },

  isImpedimentStale: () => {
    const last = get().impedimentLastFetched;
    if (last == null) return true;
    return Date.now() - last > IMPEDIMENT_REFRESH_INTERVAL_MS;
  },

  fetchOperationalData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const impedimentFields = [...JIRA_IMPEDIMENT_SEARCH_FIELDS];
      const [open, limbo, linkCarriers, landedToday, closedToday, landedLast14, resolvedLast14, landedPrev14, resolvedPrev14] = await Promise.all([
        jiraSearch(JIRA_OPERATIONAL_JQL_OPEN, JIRA_SEARCH_MAX_RESULTS, impedimentFields),
        jiraSearch(JIRA_OPERATIONAL_JQL_LIMBO, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_IMPEDIMENT_LINK_CARRIERS_JQL, JIRA_SEARCH_MAX_RESULTS, impedimentFields),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_CLOSED_TODAY, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_RESOLVED_LAST_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_LANDED_PREV_14, JIRA_SEARCH_MAX_RESULTS),
        jiraSearch(JIRA_OPERATIONAL_JQL_RESOLVED_PREV_14, JIRA_SEARCH_MAX_RESULTS),
      ]);
      const filterNova = (issues: JiraIssue[]) => filterIssuesNovaMinKey(issues);
      const openFiltered = filterNova(open.issues);
      const limboFiltered = filterNova(limbo.issues);
      const landedTodayFiltered = filterNova(landedToday.issues);
      const closedTodayFiltered = filterNova(closedToday.issues);
      const landedLast14Filtered = filterNova(landedLast14.issues);
      const resolvedLast14Filtered = filterNova(resolvedLast14.issues);
      const landedPrev14Filtered = filterNova(landedPrev14.issues);
      const resolvedPrev14Filtered = filterNova(resolvedPrev14.issues);

      // Fetch transition dates (FROM "New") for ALL open CM/OPRD tickets.
      // This is needed for accurate age calculation — age starts when the
      // ticket landed on the dev board, not when it was created by a CM.
      // Also fetch for landed-last-14 CM/OPRD for the flow chart.
      const allCmOprdKeys = new Set<string>();
      for (const i of openFiltered) {
        if (i.fields?.project?.key !== 'NOVA') allCmOprdKeys.add(i.key);
      }
      for (const i of landedLast14Filtered) {
        if (i.fields?.project?.key !== 'NOVA') allCmOprdKeys.add(i.key);
      }
      for (const i of closedTodayFiltered) {
        if (i.fields?.project?.key !== 'NOVA') allCmOprdKeys.add(i.key);
      }
      const transitionDates = allCmOprdKeys.size > 0
        ? await jiraTransitionDates(Array.from(allCmOprdKeys))
        : new Map<string, string>();

      const analytics = buildOperationalAnalytics({
        openIssues: openFiltered,
        limboCandidateIssues: limboFiltered,
        openedTodayIssues: landedTodayFiltered,
        closedTodayIssues: closedTodayFiltered,
        landedLast14: landedLast14Filtered,
        resolvedLast14: resolvedLast14Filtered,
        landedPrev14: landedPrev14Filtered,
        resolvedPrev14: resolvedPrev14Filtered,
        transitionDates,
      });

      const linkCarriersFiltered = filterNova(linkCarriers.issues);
      const impedimentAnalytics = buildImpedimentAnalytics({
        openOperationalIssues: openFiltered,
        linkCarrierIssues: linkCarriersFiltered,
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
        impedimentAnalytics,
        lastFetched: Date.now(),
        impedimentLastFetched: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch operational Jira data';
      set({ loading: false, error: message });
    }
  },

  fetchImpedimentData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isImpedimentStale()) return;
    try {
      const impedimentFields = [...JIRA_IMPEDIMENT_SEARCH_FIELDS];
      const linkCarriers = await jiraSearch(
        JIRA_IMPEDIMENT_LINK_CARRIERS_JQL,
        JIRA_SEARCH_MAX_RESULTS,
        impedimentFields
      );
      const linkCarriersFiltered = filterIssuesNovaMinKey(linkCarriers.issues);
      const impedimentAnalytics = buildImpedimentAnalytics({
        openOperationalIssues: get().openIssues,
        linkCarrierIssues: linkCarriersFiltered,
      });
      set({
        impedimentAnalytics,
        impedimentLastFetched: Date.now(),
      });
    } catch {
      // Keep existing operational data visible if this lightweight refresh fails.
    }
  },

  getAnalytics: () => get().analytics,
}));
