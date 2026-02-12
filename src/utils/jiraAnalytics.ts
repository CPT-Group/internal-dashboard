/**
 * Shared Jira analytics builders for dev-corner dashboards.
 * Used by Nova and Trevor stores so we don't duplicate by-assignee / by-project / by-type logic.
 */

import type { JiraIssue } from '@/types';
import type { NovaAnalytics, NovaAssigneeStats } from '@/types';

function getAssigneeKey(issue: JiraIssue): string {
  return issue.fields?.assignee?.accountId ?? 'unassigned';
}

function getAssigneeName(issue: JiraIssue): string {
  return issue.fields?.assignee?.displayName ?? 'Unassigned';
}

function getProjectKey(issue: JiraIssue): string {
  return issue.fields?.project?.key ?? 'unknown';
}

function getIssueTypeName(issue: JiraIssue): string {
  return issue.fields?.issuetype?.name ?? 'Unknown';
}

function getComponentNames(issue: JiraIssue): string[] {
  const comps = issue.fields?.components;
  if (!Array.isArray(comps) || comps.length === 0) return ['No component'];
  return comps.map((c) => (c && typeof c === 'object' && 'name' in c ? (c as { name: string }).name : 'Unknown')).filter(Boolean);
}

/** Days from created to resolution (or updated if no resolutiondate). Returns null if dates missing. */
function getDaysToClose(issue: JiraIssue): number | null {
  const created = issue.fields?.created;
  const resolved = issue.fields?.resolutiondate ?? issue.fields?.updated;
  if (!created || !resolved) return null;
  const a = new Date(created).getTime();
  const b = new Date(resolved).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
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

export interface BuildFromNovaQueriesInput {
  openIssues: JiraIssue[];
  todayIssues: JiraIssue[];
  overdueIssues: JiraIssue[];
  doneIssues: JiraIssue[];
}

/** Build analytics from Nova-style 4-query fetch (open, today, overdue, done). */
export function buildAnalyticsFromNovaQueries(
  input: BuildFromNovaQueriesInput
): NovaAnalytics {
  const { openIssues, todayIssues, overdueIssues, doneIssues } = input;
  const assignedOpen = openIssues.filter(isAssigned);
  const todayKeys = new Set(todayIssues.filter(isAssigned).map((i) => i.id));
  const overdueKeys = new Set(overdueIssues.filter(isAssigned).map((i) => i.id));
  const doneByAssignee = new Map<string, number>();
  doneIssues.filter(isAssigned).forEach((i) => {
    const id = getAssigneeKey(i);
    doneByAssignee.set(id, (doneByAssignee.get(id) ?? 0) + 1);
  });

  const byAssigneeMap = new Map<string, NovaAssigneeStats>();
  const byProject: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byComponent: Record<string, number> = {};
  const daysToCloseByAssignee = new Map<string, number[]>();

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

    const proj = getProjectKey(issue);
    byProject[proj] = (byProject[proj] ?? 0) + 1;
    const typeName = getIssueTypeName(issue);
    byType[typeName] = (byType[typeName] ?? 0) + 1;
    getComponentNames(issue).forEach((compName) => {
      byComponent[compName] = (byComponent[compName] ?? 0) + 1;
    });
  };

  assignedOpen.forEach(upsert);
  doneIssues.filter(isAssigned).forEach((issue) => {
    const days = getDaysToClose(issue);
    if (days == null) return;
    const id = getAssigneeKey(issue);
    const arr = daysToCloseByAssignee.get(id) ?? [];
    arr.push(days);
    daysToCloseByAssignee.set(id, arr);
  });
  daysToCloseByAssignee.forEach((daysArr, id) => {
    const cur = byAssigneeMap.get(id);
    if (!cur) return;
    const sum = daysArr.reduce((a, b) => a + b, 0);
    cur.avgDaysToClose = Math.round((sum / daysArr.length) * 10) / 10;
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
    totalOpen: assignedOpen.length,
    totalToday: todayIssues.filter(isAssigned).length,
    totalOverdue: overdueIssues.filter(isAssigned).length,
    totalDone: doneIssues.filter(isAssigned).length,
    byAssignee,
    byProject: Object.keys(byProject).length > 0 ? byProject : undefined,
    byType: Object.keys(byType).length > 0 ? byType : undefined,
    byComponent: Object.keys(byComponent).length > 0 ? byComponent : undefined,
  };
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

export interface BuildFromIssueListInput {
  issues: JiraIssue[];
  /** When set, filter to only these assignee account IDs (e.g. Trevor team). */
  filterByAccountIds?: Set<string>;
  /** Use this as totalOpen when provided (e.g. from a separate count-only JQL). */
  openCountOverride?: number | null;
}

/** Build analytics from a single issue list (Trevor-style: one JQL + optional open count). */
export function buildAnalyticsFromIssueList(
  input: BuildFromIssueListInput
): NovaAnalytics {
  const { issues, filterByAccountIds, openCountOverride } = input;
  const filtered = filterByAccountIds
    ? issues.filter((i) => {
        const id = i.fields?.assignee?.accountId;
        return id != null && filterByAccountIds.has(id);
      })
    : issues;
  const assigned = filtered.filter(isAssigned);
  const openIssues = assigned.filter((i) => !isDone(i));
  const doneIssues = assigned.filter(isDone);
  const todayIssues = assigned.filter(isUpdatedToday);
  const overdueIssues = assigned.filter(isOverdue);

  const doneByAssignee = new Map<string, number>();
  doneIssues.forEach((i) => {
    const id = getAssigneeKey(i);
    doneByAssignee.set(id, (doneByAssignee.get(id) ?? 0) + 1);
  });

  const byAssigneeMap = new Map<string, NovaAssigneeStats>();
  const byProject: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byComponent: Record<string, number> = {};
  const daysToCloseByAssignee = new Map<string, number[]>();

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

    const proj = getProjectKey(issue);
    byProject[proj] = (byProject[proj] ?? 0) + 1;
    const typeName = getIssueTypeName(issue);
    byType[typeName] = (byType[typeName] ?? 0) + 1;
    getComponentNames(issue).forEach((compName) => {
      byComponent[compName] = (byComponent[compName] ?? 0) + 1;
    });
  });

  doneIssues.forEach((issue) => {
    const days = getDaysToClose(issue);
    if (days == null) return;
    const id = getAssigneeKey(issue);
    const arr = daysToCloseByAssignee.get(id) ?? [];
    arr.push(days);
    daysToCloseByAssignee.set(id, arr);
  });

  daysToCloseByAssignee.forEach((daysArr, id) => {
    const cur = byAssigneeMap.get(id);
    if (!cur) return;
    const sum = daysArr.reduce((a, b) => a + b, 0);
    cur.avgDaysToClose = Math.round((sum / daysArr.length) * 10) / 10;
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
    totalOpen: openCountOverride != null ? openCountOverride : openIssues.length,
    totalToday: todayIssues.length,
    totalOverdue: overdueIssues.length,
    totalDone: doneIssues.length,
    byAssignee,
    byProject: Object.keys(byProject).length > 0 ? byProject : undefined,
    byType: Object.keys(byType).length > 0 ? byType : undefined,
    byComponent: Object.keys(byComponent).length > 0 ? byComponent : undefined,
  };
}
