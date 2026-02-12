import { create } from 'zustand';
import type { JiraIssue } from '@/types';
import type { NovaAnalytics, NovaAssigneeStats } from '@/types';
import { JIRA_TREVOR_CACHE_TTL_MS, JIRA_TREVOR_JQL } from '@/constants';

const MAX_RESULTS = 200;

async function searchTrevor(jql: string): Promise<JiraIssue[]> {
  const q = new URLSearchParams();
  q.set('jql', jql);
  q.set('maxResults', String(MAX_RESULTS));
  const res = await fetch(`/api/jira/search?${q.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return (json.issues ?? []) as JiraIssue[];
}

function getAssigneeKey(issue: JiraIssue): string {
  return issue.fields?.assignee?.accountId ?? 'unassigned';
}

function getAssigneeName(issue: JiraIssue): string {
  return issue.fields?.assignee?.displayName ?? 'Unassigned';
}

function isAssigned(issue: JiraIssue): boolean {
  return Boolean(issue.fields?.assignee);
}

function isDone(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

function isBug(issue: JiraIssue): boolean {
  return (issue.fields?.issuetype?.name ?? '').toLowerCase() === 'bug';
}

function isUpdatedToday(issue: JiraIssue): boolean {
  const updated = issue.fields?.updated;
  if (!updated) return false;
  const today = new Date().toISOString().slice(0, 10);
  return updated.slice(0, 10) === today;
}

function isOverdue(issue: JiraIssue): boolean {
  if (isDone(issue)) return false;
  const duedate = issue.fields?.duedate;
  if (!duedate) return false;
  return new Date(duedate) < new Date();
}

function buildAnalytics(issues: JiraIssue[]): NovaAnalytics {
  const assigned = issues.filter(isAssigned);
  const openIssues = assigned.filter((i) => !isDone(i));
  const doneIssues = assigned.filter(isDone);
  const todayIssues = assigned.filter(isUpdatedToday);
  const overdueIssues = assigned.filter(isOverdue);

  const byAssigneeMap = new Map<string, NovaAssigneeStats>();
  const doneByAssignee = new Map<string, number>();
  doneIssues.forEach((i) => {
    const id = getAssigneeKey(i);
    doneByAssignee.set(id, (doneByAssignee.get(id) ?? 0) + 1);
  });

  openIssues.forEach((issue) => {
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
    if (isUpdatedToday(issue)) cur.todayCount += 1;
    if (isOverdue(issue)) cur.overdueCount += 1;
    if (isBug(issue)) cur.bugCount += 1;
    byAssigneeMap.set(id, cur);
  });

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
    totalOpen: openIssues.length,
    totalToday: todayIssues.length,
    totalOverdue: overdueIssues.length,
    totalDone: doneIssues.length,
    byAssignee,
  };
}

interface TrevorJiraState {
  issues: JiraIssue[];
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
  lastFetched: null,
  loading: false,
  error: null,

  isStale: () => {
    const last = get().lastFetched;
    if (last == null) return true;
    return Date.now() - last > JIRA_TREVOR_CACHE_TTL_MS;
  },

  fetchTrevorData: async (force = false) => {
    if (get().loading) return;
    if (!force && !get().isStale()) return;
    set({ loading: true, error: null });
    try {
      const issues = await searchTrevor(JIRA_TREVOR_JQL);
      set({
        issues,
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
    return buildAnalytics(get().issues);
  },

  getAllIssues: () => get().issues,
}));
