import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics, NovaAssigneeStats } from '@/types';
import {
  JIRA_NOVA_CACHE_TTL_MS,
  JIRA_NOVA_JQL_TODAY,
  JIRA_NOVA_JQL_OPEN,
  JIRA_NOVA_JQL_OVERDUE,
} from '@/constants';

const MAX_RESULTS = 100;

async function searchNova(jql: string): Promise<JiraIssue[]> {
  const q = new URLSearchParams();
  q.set('jql', jql);
  q.set('maxResults', String(MAX_RESULTS));
  const res = await fetch(`/api/jira/search?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  const issues = (json.issues ?? []) as JiraIssue[];
  return issues;
}

function getAssigneeKey(issue: JiraIssue): string {
  const a = issue.fields?.assignee;
  return a?.accountId ?? 'unassigned';
}

function getAssigneeName(issue: JiraIssue): string {
  const a = issue.fields?.assignee;
  return a?.displayName ?? 'Unassigned';
}

function buildAnalytics(
  openIssues: JiraIssue[],
  todayIssues: JiraIssue[],
  overdueIssues: JiraIssue[]
): NovaAnalytics {
  const todayKeys = new Set(todayIssues.map((i) => i.id));
  const overdueKeys = new Set(overdueIssues.map((i) => i.id));
  const byAssigneeMap = new Map<string, NovaAssigneeStats>();

  const upsert = (issue: JiraIssue) => {
    const id = getAssigneeKey(issue);
    const name = getAssigneeName(issue);
    const cur = byAssigneeMap.get(id) ?? {
      assigneeId: id,
      displayName: name,
      openCount: 0,
      todayCount: 0,
      overdueCount: 0,
    };
    cur.openCount += 1;
    if (todayKeys.has(issue.id)) cur.todayCount += 1;
    if (overdueKeys.has(issue.id)) cur.overdueCount += 1;
    byAssigneeMap.set(id, cur);
  };

  openIssues.forEach(upsert);
  const byAssignee = Array.from(byAssigneeMap.values()).sort(
    (a, b) => b.openCount - a.openCount
  );

  return {
    totalOpen: openIssues.length,
    totalToday: todayIssues.length,
    totalOverdue: overdueIssues.length,
    byAssignee,
  };
}

interface JiraNovaState {
  todayIssues: JiraIssue[];
  openIssues: JiraIssue[];
  overdueIssues: JiraIssue[];
  lastFetched: number | null;
  loading: boolean;
  error: string | null;
  fetchNovaData: (force?: boolean) => Promise<void>;
  getAnalytics: () => NovaAnalytics;
  isStale: () => boolean;
}

export const useJiraNovaStore = create<JiraNovaState>((set, get) => ({
  todayIssues: [],
  openIssues: [],
  overdueIssues: [],
  lastFetched: null,
  loading: false,
  error: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > JIRA_NOVA_CACHE_TTL_MS;
  },

  fetchNovaData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [todayIssues, openIssues, overdueIssues] = await Promise.all([
        searchNova(JIRA_NOVA_JQL_TODAY),
        searchNova(JIRA_NOVA_JQL_OPEN),
        searchNova(JIRA_NOVA_JQL_OVERDUE).catch(() => [] as JiraIssue[]),
      ]);
      set({
        todayIssues,
        openIssues,
        overdueIssues,
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
    const { openIssues, todayIssues, overdueIssues } = get();
    return buildAnalytics(openIssues, todayIssues, overdueIssues);
  },
}));
