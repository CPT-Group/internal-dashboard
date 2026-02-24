/**
 * Data type for workload-by-assignee bar chart.
 * Extends horizontal bars with per-assignee percent-of-total.
 */
export interface WorkloadByAssigneeChartData {
  labels: string[];
  counts: number[];
  percentOfTotal: number[];
}
