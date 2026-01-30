export interface NovaAssigneeStats {
  assigneeId: string;
  displayName: string;
  openCount: number;
  todayCount: number;
  overdueCount: number;
  bugCount: number;
  doneCount: number;
}

export interface NovaAnalytics {
  totalOpen: number;
  totalToday: number;
  totalOverdue: number;
  totalDone: number;
  byAssignee: NovaAssigneeStats[];
}
