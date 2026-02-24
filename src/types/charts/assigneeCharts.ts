/**
 * Data types for assignee-based charts (open/closed/avg by assignee).
 */

/** One row of assignee stats for chart consumption. */
export interface AssigneeStatRow {
  displayName: string;
  openCount: number;
  doneCount?: number;
  avgDaysToClose?: number;
}

/**
 * Data for radar chart: Open, Closed, and Avg hours to close per assignee.
 * Used by OpenClosedAvgHoursByAssigneeRadarChart.
 */
export interface OpenClosedAvgHoursByAssigneeRadarChartData {
  labels: string[];
  open: number[];
  closed: number[];
  avgHours: number[];
  /** For tooltip: show days when >= 1. */
  avgDays: number[];
}

/**
 * Data for horizontal or vertical bar+line: Open count + Avg days to close per assignee.
 * Used by OpenAndAvgDaysByAssigneeComboChart (horizontal) and OpenAndAvgDaysByAssigneeBarLineChart (vertical).
 */
export interface OpenAndAvgDaysByAssigneeChartData {
  labels: string[];
  open: number[];
  avgDays: number[];
}
