/**
 * Data types for flow / opened-closed-over-time charts.
 */

/**
 * Data for opened vs closed over time (e.g. last 14 days).
 * Used by OpenedClosedFlowBarChart.
 */
export interface OpenedClosedFlowChartData {
  labels: string[];
  opened: number[];
  closed: number[];
}
