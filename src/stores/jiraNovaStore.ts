import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics, NovaAssigneeStats } from '@/types';
import {
  JIRA_NOVA_CACHE_TTL_MS,
  JIRA_NOVA_JQL_TODAY,
  JIRA_NOVA_JQL_OPEN,
  JIRA_NOVA_JQL_OVERDUE,
  JIRA_NOVA_JQL_DONE,
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

function isAssigned(issue: JiraIssue): boolean {
  return Boolean(issue.fields?.assignee);
}

function isBug(issue: JiraIssue): boolean {
  const name = issue.fields?.issuetype?.name ?? '';
  return name.toLowerCase() === 'bug';
}

function buildAnalytics(
  openIssues: JiraIssue[],
  todayIssues: JiraIssue[],
  overdueIssues: JiraIssue[],
  doneIssues: JiraIssue[]
): NovaAnalytics {
  const assignedOpen = openIssues.filter(isAssigned);
  const todayKeys = new Set(todayIssues.filter(isAssigned).map((i) => i.id));
  const overdueKeys = new Set(overdueIssues.filter(isAssigned).map((i) => i.id));
  const doneByAssignee = new Map<string, number>();
  doneIssues.filter(isAssigned).forEach((i) => {
    const id = getAssigneeKey(i);
    doneByAssignee.set(id, (doneByAssignee.get(id) ?? 0) + 1);
  });
  const byAssigneeMap = new Map<string, NovaAssigneeStats>();

  const upsert = (issue: JiraIssue) => {
    if (!isAssigned(issue)) return;
    const id = getAssigneeKey(issue);
    const name = getAssigneeName(issue);
    const cur = byAssigneeMap.get(id) ?? {
      assigneeId: id,
      displayName: name,
      openCount: 0,
      todayCount: 0,
      overdueCount: 0,
      bugCount: 0,
      doneCount: doneByAssignee.get(id) ?? 0,
    };
    cur.openCount += 1;
    if (todayKeys.has(issue.id)) cur.todayCount += 1;
    if (overdueKeys.has(issue.id)) cur.overdueCount += 1;
    if (isBug(issue)) cur.bugCount += 1;
    byAssigneeMap.set(id, cur);
  };

  assignedOpen.forEach(upsert);
  doneByAssignee.forEach((count, id) => {
    if (!byAssigneeMap.has(id)) {
      const issue = doneIssues.find((i) => getAssigneeKey(i) === id);
      byAssigneeMap.set(id, {
        assigneeId: id,
        displayName: issue ? getAssigneeName(issue) : 'Unassigned',
        openCount: 0,
        todayCount: 0,
        overdueCount: 0,
        bugCount: 0,
        doneCount: count,
      });
    } else {
      byAssigneeMap.get(id)!.doneCount = count;
    }
  });
  const byAssignee = Array.from(byAssigneeMap.values()).sort(
    (a, b) => b.openCount - a.openCount
  );

  return {
    totalOpen: assignedOpen.length,
    totalToday: todayIssues.filter(isAssigned).length,
    totalOverdue: overdueIssues.filter(isAssigned).length,
    totalDone: doneIssues.filter(isAssigned).length,
    byAssignee,
  };
}

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
  /** All unique issues (for Gantt, filtering, etc.) */
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
    return Date.now() - last > JIRA_NOVA_CACHE_TTL_MS;
  },

  fetchNovaData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const [todayIssues, openIssues, overdueIssues, doneIssues] = await Promise.all([
        searchNova(JIRA_NOVA_JQL_TODAY),
        searchNova(JIRA_NOVA_JQL_OPEN),
        searchNova(JIRA_NOVA_JQL_OVERDUE).catch(() => [] as JiraIssue[]),
        searchNova(JIRA_NOVA_JQL_DONE).catch(() => [] as JiraIssue[]),
      ]);
      set({
        todayIssues,
        openIssues,
        overdueIssues,
        doneIssues,
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
    return buildAnalytics(openIssues, todayIssues, overdueIssues, doneIssues);
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
