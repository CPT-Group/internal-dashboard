/**
 * Data types for horizontal bar charts (backlog by component, aging buckets, work hours, etc.).
 */

/**
 * Generic horizontal bar chart: one label per bar, one value per bar.
 * Optional per-bar colors (e.g. for aging severity or hour thresholds).
 */
export interface HorizontalBarChartData {
  labels: string[];
  values: number[];
  colors?: string[];
  borderColors?: string[];
  /** Suffix appended to data labels (e.g. "h" for hours). */
  suffix?: string;
  /** Bar indices that should pulse/flash (e.g. danger-zone values). */
  flashIndices?: number[];
}
