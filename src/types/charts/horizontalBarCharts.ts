/**
 * Data types for horizontal bar charts (backlog by component, aging buckets, etc.).
 */

/**
 * Generic horizontal bar chart: one label per bar, one value per bar.
 * Optional per-bar colors (e.g. for aging severity).
 */
export interface HorizontalBarChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}
