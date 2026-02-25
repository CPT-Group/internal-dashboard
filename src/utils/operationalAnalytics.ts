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
  AgingHotspot,
  TrendComparison,
  ComponentActivity,
  TeamMemberActivity,
  InProgressTicket,
  RecentlyCompletedTicket,
} from '@/types';
import {
  DEV1_RISK_BUCKET_WEIGHTS,
  DEV1_RISK_MAX_RAW,
  DEV1_HOTSPOT_LIMIT,
  NOVA_TEAM_ACCOUNT_IDS,
  NOVA_TEAM_ORDERED,
} from '@/constants';

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

function isInProgress(issue: JiraIssue): boolean {
  return issue.fields?.status?.statusCategory?.key === 'indeterminate';
}

function isNovaTeam(issue: JiraIssue): boolean {
  const id = issue.fields?.assignee?.accountId;
  return id != null && NOVA_TEAM_ACCOUNT_IDS.has(id);
}

function getProjectKey(issue: JiraIssue): string {
  return issue.fields?.project?.key ?? '';
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
  /** Issues that "landed on team" in last 14 days (CM/OPRD transitioned from New + NOVA created). */
  landedLast14: JiraIssue[];
  resolvedLast14: JiraIssue[];
  landedPrev14?: JiraIssue[];
  resolvedPrev14?: JiraIssue[];
  /** Map of issueKey → ISO date for CM/OPRD transition FROM "New". NOVA uses created date. */
  transitionDates?: Map<string, string>;
}

export function buildOperationalAnalytics(input: BuildOperationalAnalyticsInput): OperationalAnalytics {
  const {
    openIssues,
    openedTodayIssues,
    closedTodayIssues,
    landedLast14,
    resolvedLast14,
    landedPrev14,
    resolvedPrev14,
    transitionDates = new Map(),
  } = input;

  const open = openIssues.filter((i) => !isDone(i));
  const landedToday = openedTodayIssues.length;
  const closedToday = closedTodayIssues.length;
  const netChangeToday = landedToday - closedToday;

  const ages = open.map(getAgeDays).filter((a) => a >= 0);
  const avgAgeDays = ages.length ? Math.round((ages.reduce((s, a) => s + a, 0) / ages.length) * 10) / 10 : 0;
  const oldestAgeDays = ages.length ? Math.max(...ages) : 0;

  const avgCloseTimeHours = buildAvgCloseTime(resolvedLast14);

  const kpis: OperationalKpis = {
    openCount: open.length,
    landedToday,
    closedToday,
    netChangeToday,
    avgAgeDays,
    oldestAgeDays,
    avgCloseTimeHours,
  };

  const dayCountsLanded: Record<string, number> = {};
  const dayCountsResolved: Record<string, number> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dateStr(d);
    dayCountsLanded[key] = 0;
    dayCountsResolved[key] = 0;
  }
  landedLast14.forEach((issue) => {
    const project = issue.fields?.project?.key;
    let landedDate: string | undefined;
    if (project === 'NOVA') {
      landedDate = issue.fields?.created?.slice(0, 10);
    } else {
      const transDate = transitionDates.get(issue.key);
      landedDate = transDate ? transDate.slice(0, 10) : issue.fields?.created?.slice(0, 10);
    }
    if (landedDate && landedDate in dayCountsLanded) dayCountsLanded[landedDate]++;
  });
  resolvedLast14.forEach((issue) => {
    const key = issue.fields?.resolutiondate?.slice(0, 10);
    if (key && key in dayCountsResolved) dayCountsResolved[key]++;
  });
  const flowData: FlowDay[] = Object.keys(dayCountsLanded)
    .sort()
    .map((date) => ({
      date,
      opened: dayCountsLanded[date] ?? 0,
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

  const throughputRatio =
    landedLast14.length > 0
      ? Math.round((resolvedLast14.length / landedLast14.length) * 100) / 100
      : 0;

  const riskRawScore = agingBuckets.reduce(
    (sum, bucket, idx) => sum + bucket.count * (DEV1_RISK_BUCKET_WEIGHTS[idx] ?? 0),
    0
  );
  const riskScore = Math.min(
    100,
    Math.round((riskRawScore / DEV1_RISK_MAX_RAW) * 100)
  );

  const agingHotspots = buildAgingHotspots(open);

  const trendVsPrevious14d = buildTrendComparison(
    landedLast14,
    resolvedLast14,
    landedPrev14,
    resolvedPrev14
  );

  const componentActivity = buildComponentActivity(open, openedTodayIssues, landedLast14, transitionDates);
  const teamActivity = buildTeamActivity(open);
  const inProgressTickets = buildInProgressTickets(open);
  const recentlyCompleted = buildRecentlyCompleted(resolvedLast14);

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
    throughputRatio,
    riskScore,
    agingHotspots,
    trendVsPrevious14d,
    componentActivity,
    teamActivity,
    inProgressTickets,
    recentlyCompleted,
  };
}

function buildAgingHotspots(open: JiraIssue[]): AgingHotspot[] {
  const grouped = new Map<string, { totalAge: number; count: number; component: string; assignee: string }>();
  for (const issue of open) {
    const assignee = getAssigneeName(issue);
    const age = getAgeDays(issue);
    for (const comp of getComponentNames(issue)) {
      const key = `${comp}|${assignee}`;
      const entry = grouped.get(key);
      if (entry) {
        entry.totalAge += age;
        entry.count++;
      } else {
        grouped.set(key, { totalAge: age, count: 1, component: comp, assignee });
      }
    }
  }
  return Array.from(grouped.values())
    .map(({ totalAge, count, component, assignee }) => ({
      component,
      assignee,
      avgAgeDays: Math.round((totalAge / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.avgAgeDays - a.avgAgeDays)
    .slice(0, DEV1_HOTSPOT_LIMIT);
}

function buildTrendComparison(
  landedLast14: JiraIssue[],
  resolvedLast14: JiraIssue[],
  landedPrev14?: JiraIssue[],
  resolvedPrev14?: JiraIssue[]
): TrendComparison | null {
  if (!landedPrev14 || !resolvedPrev14) return null;
  const prevOpened = landedPrev14.length;
  const prevClosed = resolvedPrev14.length;
  return {
    openedDelta: landedLast14.length - prevOpened,
    closedDelta: resolvedLast14.length - prevClosed,
    prevOpened,
    prevClosed,
  };
}

function buildAvgCloseTime(resolvedLast14: JiraIssue[]): number | null {
  const closeTimes: number[] = [];
  for (const issue of resolvedLast14) {
    const created = issue.fields?.created;
    const resolved = issue.fields?.resolutiondate;
    if (!created || !resolved) continue;
    const hours = (new Date(resolved).getTime() - new Date(created).getTime()) / (60 * 60 * 1000);
    if (hours >= 0) closeTimes.push(hours);
  }
  if (closeTimes.length === 0) return null;
  return Math.round((closeTimes.reduce((s, h) => s + h, 0) / closeTimes.length) * 10) / 10;
}

function buildComponentActivity(
  open: JiraIssue[],
  landedToday: JiraIssue[],
  landedLast14: JiraIssue[],
  transitionDates: Map<string, string>
): ComponentActivity[] {
  const map = new Map<string, ComponentActivity>();

  const ensureComp = (name: string) => {
    if (!map.has(name)) {
      map.set(name, { component: name, openCount: 0, landedToday: 0, landedThisWeek: 0, hasAging: false });
    }
    return map.get(name)!;
  };

  for (const issue of open) {
    const age = getAgeDays(issue);
    for (const comp of getComponentNames(issue)) {
      const entry = ensureComp(comp);
      entry.openCount++;
      if (age > AGING_DAYS_THRESHOLD) entry.hasAging = true;
    }
  }

  for (const issue of landedToday) {
    for (const comp of getComponentNames(issue)) {
      ensureComp(comp).landedToday++;
    }
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const weekStart = dateStr(startOfWeek);

  for (const issue of landedLast14) {
    const project = issue.fields?.project?.key;
    let landedDate: string | undefined;
    if (project === 'NOVA') {
      landedDate = issue.fields?.created?.slice(0, 10);
    } else {
      const td = transitionDates.get(issue.key);
      landedDate = td ? td.slice(0, 10) : issue.fields?.created?.slice(0, 10);
    }
    if (landedDate && landedDate >= weekStart) {
      for (const comp of getComponentNames(issue)) {
        ensureComp(comp).landedThisWeek++;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.openCount - a.openCount);
}

function buildTeamActivity(open: JiraIssue[]): TeamMemberActivity[] {
  return NOVA_TEAM_ORDERED.map(({ accountId, displayName }) => {
    const myOpen = open.filter((i) => i.fields?.assignee?.accountId === accountId);
    const myInProgress = myOpen.filter(isInProgress);
    return {
      accountId,
      displayName,
      inProgressCount: myInProgress.length,
      openCount: myOpen.length,
      inProgressKeys: myInProgress.map((i) => i.key),
      inProgressSummaries: myInProgress.map((i) => (i.fields?.summary ?? '').slice(0, 50)),
    };
  });
}

function buildInProgressTickets(open: JiraIssue[]): InProgressTicket[] {
  return open
    .filter(isInProgress)
    .sort((a, b) => getAgeDays(b) - getAgeDays(a))
    .slice(0, 20)
    .map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      assignee: getAssigneeName(issue),
      component: getComponentNames(issue).join(', '),
      status: issue.fields?.status?.name ?? '',
      ageDays: getAgeDays(issue),
      project: getProjectKey(issue),
    }));
}

function buildRecentlyCompleted(resolvedLast14: JiraIssue[]): RecentlyCompletedTicket[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = dateStr(sevenDaysAgo);

  return resolvedLast14
    .filter((i) => {
      const rd = i.fields?.resolutiondate?.slice(0, 10);
      return rd && rd >= cutoff;
    })
    .sort((a, b) => {
      const aDate = a.fields?.resolutiondate ?? '';
      const bDate = b.fields?.resolutiondate ?? '';
      return bDate.localeCompare(aDate);
    })
    .slice(0, 20)
    .map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      assignee: getAssigneeName(issue),
      component: getComponentNames(issue).join(', '),
      resolvedDate: issue.fields?.resolutiondate?.slice(0, 10) ?? '',
      project: getProjectKey(issue),
    }));
}
