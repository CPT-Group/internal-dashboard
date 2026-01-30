export interface NovaAssigneeStats {
  assigneeId: string;
  displayName: string;
  openCount: number;
  todayCount: number;
  overdueCount: number;
}

export interface NovaAnalytics {
  totalOpen: number;
  totalToday: number;
  totalOverdue: number;
  byAssignee: NovaAssigneeStats[];
}
