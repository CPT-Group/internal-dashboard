export interface NovaAssigneeStats {
  assigneeId: string;
  displayName: string;
  openCount: number;
  todayCount: number;
  overdueCount: number;
  bugCount: number;
  doneCount: number;
  /** Average days from created to resolution (done issues only). */
  avgDaysToClose?: number;
}

export interface NovaAnalytics {
  totalOpen: number;
  totalToday: number;
  totalOverdue: number;
  totalDone: number;
  byAssignee: NovaAssigneeStats[];
  /** Open (or total) count by project key (e.g. NOVA, CM, OPRD). */
  byProject?: Record<string, number>;
  /** Open count by issue type (e.g. Bug, Story, Task). */
  byType?: Record<string, number>;
  /** Open count by Jira component (e.g. Backend, Frontend). */
  byComponent?: Record<string, number>;
  /** Open count by assignee then component (for stacked bars: assigneeId -> componentName -> count). */
  byAssigneeByComponent?: Record<string, Record<string, number>>;
  /** Open count by board then component (for stacked bars: projectKey -> componentName -> count). */
  byBoardByComponent?: Record<string, Record<string, number>>;
}
