/**
 * Data types for board/component stacked bar charts.
 */

/**
 * Data for stacked horizontal bar chart: open count by board (and optionally by component).
 * Used by ByBoardByComponentStackedBarChart.
 */
export interface ByBoardByComponentChartData {
  boardKeys: string[];
  byBoardByComponent: Record<string, Record<string, number>>;
  byProject: Record<string, number>;
}
