/**
 * Analytics for the operational Jira TV dashboard (today/sprint, flow, load, aging).
 */

export interface OperationalKpis {
  openCount: number;
  /** Open tickets from NOVA project only. */
  openNova: number;
  /** Open tickets from CM + OPRD (production/client work). */
  openProd: number;
  /** Tickets that landed on team today (transitioned from New or created for NOVA). */
  landedToday: number;
  closedToday: number;
  netChangeToday: number;
  avgAgeDays: number;
  oldestAgeDays: number;
  /** Average hours from created to resolved (last 14d resolved tickets). */
  avgCloseTimeHours: number | null;
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

/** Per-component breakdown with time-based activity counts. */
export interface ComponentActivity {
  component: string;
  openCount: number;
  landedToday: number;
  landedThisWeek: number;
  hasAging: boolean;
}

/** Per-NOVA-team-member activity summary. */
export interface TeamMemberActivity {
  accountId: string;
  displayName: string;
  inProgressCount: number;
  openCount: number;
  /** Issue keys currently in progress for this member. */
  inProgressKeys: string[];
  /** Summaries of in-progress tickets (for display). */
  inProgressSummaries: string[];
}

/** In-progress ticket for company-facing card display. */
export interface InProgressTicket {
  key: string;
  summary: string;
  assignee: string;
  component: string;
  status: string;
  ageDays: number;
  project: string;
}

/** Recently completed ticket for company-facing display. Uses Tech Owner, not assignee. */
export interface RecentlyCompletedTicket {
  key: string;
  summary: string;
  /** Tech Owner – the dev who actually did the work (not the CM who approved). */
  techOwner: string;
  component: string;
  resolvedDate: string;
  project: string;
}

/** Ticket that has been requested but not yet started by a developer. */
export interface RequestedTicket {
  key: string;
  summary: string;
  assignee: string;
  component: string;
  status: string;
  ageDays: number;
  project: string;
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
  /** Per-component activity (open + today + this week). */
  componentActivity: ComponentActivity[];
  /** NOVA team member activity summaries (Dev 1). */
  teamActivity: TeamMemberActivity[];
  /** Tickets currently in progress across all projects (Dev 2 cards). */
  inProgressTickets: InProgressTicket[];
  /** Tickets resolved in last 7 days (Dev 2 table). */
  recentlyCompleted: RecentlyCompletedTicket[];
  /** Tickets requested but not yet started by dev team (Dev 2 slide). */
  requestedTickets: RequestedTicket[];
}
