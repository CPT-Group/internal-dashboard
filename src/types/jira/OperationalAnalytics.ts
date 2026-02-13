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

export interface OperationalAnalytics {
  kpis: OperationalKpis;
  flowData: FlowDay[];
  backlogByComponent: BacklogByComponentItem[];
  backlogByAssignee: BacklogByAssigneeItem[];
  backlogByDueDate: BacklogByDueDateItem[];
  devLoadMatrix: DevLoadMatrixCell[]; // flat for heatmap: row=assignee, col=component
  assignees: string[];
  components: string[];
  agingBuckets: AgingBucket[];
  oldest10: OldestTicketRow[];
}
