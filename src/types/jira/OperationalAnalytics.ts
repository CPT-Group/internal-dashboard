/**
 * Analytics for the operational Jira TV dashboard (today/sprint, flow, load, aging).
 */

export interface OperationalKpis {
  openCount: number;
  openedToday: number;
  closedToday: number;
  netChangeToday: number;
  avgAgeDays: number;
  oldestAgeDays: number;
  sprintCompletionPercent: number | null;
}

export interface FlowDay {
  date: string; // YYYY-MM-DD
  opened: number;
  closed: number;
}

export interface BacklogByComponentItem {
  component: string;
  openCount: number;
  hasAging: boolean; // any ticket > 7 days
}

export interface BacklogByAssigneeItem {
  assigneeName: string;
  openCount: number;
}

export interface BacklogByDueDateItem {
  label: string;
  openCount: number;
}

export interface DevLoadMatrixCell {
  assigneeId: string;
  assigneeName: string;
  component: string;
  count: number;
}

export interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number;
  count: number;
}

export interface OldestTicketRow {
  key: string;
  summary: string;
  assignee: string;
  component: string;
  ageDays: number;
  status: string;
}

export interface AgingHotspot {
  component: string;
  assignee: string;
  avgAgeDays: number;
  count: number;
}

export interface TrendComparison {
  openedDelta: number;
  closedDelta: number;
  prevOpened: number;
  prevClosed: number;
}

export interface OperationalAnalytics {
  kpis: OperationalKpis;
  flowData: FlowDay[];
  backlogByComponent: BacklogByComponentItem[];
  backlogByAssignee: BacklogByAssigneeItem[];
  backlogByDueDate: BacklogByDueDateItem[];
  devLoadMatrix: DevLoadMatrixCell[];
  assignees: string[];
  components: string[];
  agingBuckets: AgingBucket[];
  oldest10: OldestTicketRow[];
  /** Closed / opened ratio over 14-day window (> 1 = closing faster than opening). */
  throughputRatio: number;
  /** 0–100 weighted score from aging buckets; higher = more risk. */
  riskScore: number;
  /** Top 5 component+assignee combos with worst average age. */
  agingHotspots: AgingHotspot[];
  /** Current 14d vs previous 14d opened/closed comparison (null until prev-14d data is fetched). */
  trendVsPrevious14d: TrendComparison | null;
}
