/**
 * Build operational Jira analytics for the TV dashboard (KPIs, flow, backlog, heatmap, aging).
 */
import type { JiraIssue } from '@/types';
import type {
  OperationalAnalytics,
  OperationalKpis,
  FlowDay,
  BacklogByComponentItem,
  BacklogByAssigneeItem,
  BacklogByDueDateItem,
  DevLoadMatrixCell,
  AgingBucket,
  OldestTicketRow,
} from '@/types';

const AGING_DAYS_THRESHOLD = 7;

function getAssigneeKey(issue: JiraIssue): string {
  return issue.fields?.assignee?.accountId ?? 'unassigned';
}

function getAssigneeName(issue: JiraIssue): string {
  return issue.fields?.assignee?.displayName ?? 'Unassigned';
}

function getComponentNames(issue: JiraIssue): string[] {
  const comps = issue.fields?.components;
  if (!Array.isArray(comps) || comps.length === 0) return ['No component'];
  return comps
    .map((c) => (c && typeof c === 'object' && 'name' in c ? (c as { name: string }).name : 'Unknown'))
    .filter(Boolean);
}

function isDone(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'done';
}

/** Days since created (for open issues). */
function getAgeDays(issue: JiraIssue): number {
  const created = issue.fields?.created;
  if (!created) return 0;
  const ms = Date.now() - new Date(created).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface BuildOperationalAnalyticsInput {
  openIssues: JiraIssue[];
  openedTodayIssues: JiraIssue[];
  closedTodayIssues: JiraIssue[];
  createdLast14: JiraIssue[];
  resolvedLast14: JiraIssue[];
}

export function buildOperationalAnalytics(input: BuildOperationalAnalyticsInput): OperationalAnalytics {
  const {
    openIssues,
    openedTodayIssues,
    closedTodayIssues,
    createdLast14,
    resolvedLast14,
  } = input;

  const open = openIssues.filter((i) => !isDone(i));
  const openedToday = openedTodayIssues.length;
  const closedToday = closedTodayIssues.length;
  const netChangeToday = openedToday - closedToday;

  const ages = open.map(getAgeDays).filter((a) => a >= 0);
  const avgAgeDays = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : 0;
  const oldestAgeDays = ages.length ? Math.max(...ages) : 0;

  const kpis: OperationalKpis = {
    openCount: open.length,
    openedToday,
    closedToday,
    netChangeToday,
    avgAgeDays,
    oldestAgeDays,
    sprintCompletionPercent: null,
  };

  const todayStr = dateStr(new Date());
  const dayCountsCreated: Record<string, number> = {};
  const dayCountsResolved: Record<string, number> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dateStr(d);
    dayCountsCreated[key] = 0;
    dayCountsResolved[key] = 0;
  }
  createdLast14.forEach((issue) => {
    const key = issue.fields?.created?.slice(0, 10);
    if (key && key in dayCountsCreated) dayCountsCreated[key]++;
  });
  resolvedLast14.forEach((issue) => {
    const key = issue.fields?.resolutiondate?.slice(0, 10);
    if (key && key in dayCountsResolved) dayCountsResolved[key]++;
  });
  const flowData: FlowDay[] = Object.keys(dayCountsCreated)
    .sort()
    .map((date) => ({
      date,
      opened: dayCountsCreated[date] ?? 0,
      closed: dayCountsResolved[date] ?? 0,
    }));

  const byComponent: Record<string, { count: number; hasAging: boolean }> = {};
  open.forEach((issue) => {
    const comps = getComponentNames(issue);
    const age = getAgeDays(issue);
    comps.forEach((name) => {
      if (!byComponent[name]) byComponent[name] = { count: 0, hasAging: false };
      byComponent[name].count++;
      if (age > AGING_DAYS_THRESHOLD) byComponent[name].hasAging = true;
    });
  });
  const backlogByComponent: BacklogByComponentItem[] = Object.entries(byComponent)
    .map(([component, { count, hasAging }]) => ({ component, openCount: count, hasAging }))
    .sort((a, b) => b.openCount - a.openCount);

  const byAssignee: Record<string, number> = {};
  open.forEach((issue) => {
    const name = getAssigneeName(issue);
    byAssignee[name] = (byAssignee[name] ?? 0) + 1;
  });
  const backlogByAssignee: BacklogByAssigneeItem[] = Object.entries(byAssignee)
    .map(([assigneeName, openCount]) => ({ assigneeName, openCount }))
    .sort((a, b) => b.openCount - a.openCount);

  const nowDate = new Date();
  nowDate.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(nowDate);
  endOfWeek.setDate(nowDate.getDate() + (7 - nowDate.getDay()));
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);
  const dueBuckets: Record<string, number> = { Overdue: 0, 'This week': 0, 'Next week': 0, Later: 0, 'No date': 0 };
  open.forEach((issue) => {
    const raw = issue.fields?.duedate;
    if (!raw) {
      dueBuckets['No date']++;
      return;
    }
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    if (d < nowDate) dueBuckets['Overdue']++;
    else if (d <= endOfWeek) dueBuckets['This week']++;
    else if (d <= endOfNextWeek) dueBuckets['Next week']++;
    else dueBuckets['Later']++;
  });
  const backlogByDueDate: BacklogByDueDateItem[] = [
    { label: 'Overdue', openCount: dueBuckets['Overdue'] },
    { label: 'This week', openCount: dueBuckets['This week'] },
    { label: 'Next week', openCount: dueBuckets['Next week'] },
    { label: 'Later', openCount: dueBuckets['Later'] },
    { label: 'No date', openCount: dueBuckets['No date'] },
  ];

  const assigneeSet = new Set<string>();
  const componentSet = new Set<string>();
  const matrixMap = new Map<string, number>();
  open.forEach((issue) => {
    const aid = getAssigneeKey(issue);
    const aname = getAssigneeName(issue);
    assigneeSet.add(aid);
    getComponentNames(issue).forEach((comp) => {
      componentSet.add(comp);
      const key = `${aid}|${comp}`;
      matrixMap.set(key, (matrixMap.get(key) ?? 0) + 1);
    });
  });
  const assignees = Array.from(assigneeSet);
  const components = Array.from(componentSet).sort();
  const devLoadMatrix: DevLoadMatrixCell[] = [];
  const nameByAssignee = new Map<string, string>();
  open.forEach((i) => nameByAssignee.set(getAssigneeKey(i), getAssigneeName(i)));
  assignees.forEach((assigneeId) => {
    components.forEach((component) => {
      const count = matrixMap.get(`${assigneeId}|${component}`) ?? 0;
      devLoadMatrix.push({
        assigneeId,
        assigneeName: nameByAssignee.get(assigneeId) ?? assigneeId,
        component,
        count,
      });
    });
  });

  const bucketDefs: { label: string; minDays: number; maxDays: number }[] = [
    { label: '0–1d', minDays: 0, maxDays: 1 },
    { label: '2–3d', minDays: 2, maxDays: 3 },
    { label: '4–7d', minDays: 4, maxDays: 7 },
    { label: '8–14d', minDays: 8, maxDays: 14 },
    { label: '15+d', minDays: 15, maxDays: 9999 },
  ];
  const agingBuckets: AgingBucket[] = bucketDefs.map(({ label, minDays, maxDays }) => ({
    label,
    minDays,
    maxDays,
    count: ages.filter((a) => a >= minDays && a <= maxDays).length,
  }));

  const oldest10: OldestTicketRow[] = [...open]
    .sort((a, b) => getAgeDays(b) - getAgeDays(a))
    .slice(0, 10)
    .map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      assignee: getAssigneeName(issue),
      component: getComponentNames(issue).join(', '),
      ageDays: getAgeDays(issue),
      status: issue.fields?.status?.name ?? '',
    }));

  return {
    kpis,
    flowData,
    backlogByComponent,
    backlogByAssignee,
    backlogByDueDate,
    devLoadMatrix,
    assignees,
    components,
    agingBuckets,
    oldest10,
  };
}
