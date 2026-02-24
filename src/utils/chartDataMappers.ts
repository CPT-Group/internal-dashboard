/**
 * Mappers from analytics (NovaAnalytics, OperationalAnalytics, etc.) to chart data types.
 * Pages get analytics from the store, call the appropriate mapper, and pass result to chart components.
 * Chart components stay presentation-only; they never see raw analytics.
 */

import type { NovaAnalytics, OperationalAnalytics } from '@/types';
import type {
  OpenClosedAvgHoursByAssigneeRadarChartData,
  OpenAndAvgDaysByAssigneeChartData,
  ByBoardByComponentChartData,
  OpenedClosedFlowChartData,
  HorizontalBarChartData,
} from '@/types/charts';

const HOURS_PER_DAY = 24;

/** Ordered team: { accountId, displayName }[] so chart shows fixed order (e.g. Trevor's 4). */
export interface OrderedTeamMember {
  accountId: string;
  displayName: string;
}

/**
 * Build radar chart data: Open, Closed, Avg hours (and avgDays for tooltip) per assignee.
 * Uses orderedTeam so all members appear in the same order (e.g. Roy, James, Thomas, Kyle).
 */
export function toOpenClosedAvgHoursByAssigneeRadarChartData(
  analytics: NovaAnalytics,
  orderedTeam: OrderedTeamMember[]
): OpenClosedAvgHoursByAssigneeRadarChartData {
  const byMap = new Map(
    analytics.byAssignee.map((a) => [a.assigneeId, a])
  );
  const labels = orderedTeam.map((m) => m.displayName);
  const accountIds = orderedTeam.map((m) => m.accountId);
  const open = accountIds.map((id) => byMap.get(id)?.openCount ?? 0);
  const closed = accountIds.map((id) => byMap.get(id)?.doneCount ?? 0);
  const avgDays = accountIds.map(
    (id) => byMap.get(id)?.avgDaysToClose ?? 0
  );
  const avgHours = avgDays.map((d) =>
    Math.round(d * HOURS_PER_DAY * 10) / 10
  );
  return { labels, open, closed, avgHours, avgDays };
}

/**
 * Build bar+line chart data: Open and Avg days per assignee.
 * If orderedTeam is provided, use that order; otherwise use analytics.byAssignee order.
 */
export function toOpenAndAvgDaysByAssigneeChartData(
  analytics: NovaAnalytics,
  orderedTeam?: OrderedTeamMember[]
): OpenAndAvgDaysByAssigneeChartData {
  if (orderedTeam != null && orderedTeam.length > 0) {
    const byMap = new Map(
      analytics.byAssignee.map((a) => [a.assigneeId, a])
    );
    const labels = orderedTeam.map((m) => m.displayName);
    const accountIds = orderedTeam.map((m) => m.accountId);
    const open = accountIds.map((id) => byMap.get(id)?.openCount ?? 0);
    const avgDays = accountIds.map(
      (id) => byMap.get(id)?.avgDaysToClose ?? 0
    );
    return { labels, open, avgDays };
  }
  const labels = analytics.byAssignee.map((a) => a.displayName);
  const open = analytics.byAssignee.map((a) => a.openCount);
  const avgDays = analytics.byAssignee.map((a) => a.avgDaysToClose ?? 0);
  return { labels, open, avgDays };
}

/**
 * Build stacked bar chart data: boards and by-board-by-component counts.
 */
export function toByBoardByComponentChartData(
  analytics: NovaAnalytics
): ByBoardByComponentChartData {
  const byProject = analytics.byProject ?? {};
  const byBoardByComponent = analytics.byBoardByComponent ?? {};
  const boardKeys = Object.keys(byProject).sort();
  return {
    boardKeys,
    byBoardByComponent,
    byProject,
  };
}

/**
 * Build flow chart data: opened vs closed per day (e.g. last 14 days).
 */
export function toOpenedClosedFlowChartData(
  analytics: OperationalAnalytics
): OpenedClosedFlowChartData {
  const flowData = analytics.flowData;
  return {
    labels: flowData.map((d) => d.date.slice(5)),
    opened: flowData.map((d) => d.opened),
    closed: flowData.map((d) => d.closed),
  };
}

/**
 * Build horizontal bar data for backlog by component (optional color for aging).
 */
export function toBacklogByComponentBarChartData(
  analytics: OperationalAnalytics
): HorizontalBarChartData {
  const items = analytics.backlogByComponent;
  return {
    labels: items.map((b) => b.component),
    values: items.map((b) => b.openCount),
    colors: items.map((b) =>
      b.hasAging ? 'rgba(234, 179, 8, 0.8)' : 'rgba(59, 130, 246, 0.7)'
    ),
  };
}

/**
 * Build horizontal bar data for aging buckets.
 */
export function toAgingBucketsBarChartData(
  analytics: OperationalAnalytics
): HorizontalBarChartData {
  const buckets = analytics.agingBuckets;
  const colors = [
    'rgba(34, 197, 94, 0.7)',
    'rgba(59, 130, 246, 0.7)',
    'rgba(234, 179, 8, 0.7)',
    'rgba(249, 115, 22, 0.7)',
    'rgba(239, 68, 68, 0.7)',
  ];
  return {
    labels: buckets.map((b) => b.label),
    values: buckets.map((b) => b.count),
    colors: buckets.map((_, i) => colors[i % colors.length]),
  };
}
