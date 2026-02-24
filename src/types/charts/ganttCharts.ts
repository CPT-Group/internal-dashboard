/**
 * Data type for timeline / Gantt-style charts.
 */

/**
 * One task row for the Dev Team Timeline (horizontal bar with start/end dates).
 */
export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}
