'use client';

import { FrappeGantt, Task, ViewMode } from 'react-frappe-gantt';

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(s: string): boolean {
  if (!s || !YYYY_MM_DD.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

interface GanttChartProps {
  tasks: GanttTask[];
}

export const GanttChart = ({ tasks }: GanttChartProps) => {
  const validTasks = tasks.filter(
    (t) => t && isValidDateString(t.start) && isValidDateString(t.end)
  );
  if (validTasks.length === 0) {
    return (
      <div className="text-color-secondary text-sm p-2">
        No tasks with valid dates to show on the timeline.
      </div>
    );
  }
  const ganttTasks = validTasks.map((t) => new Task(t));
  return (
    <FrappeGantt
      tasks={ganttTasks}
      viewMode={ViewMode.Week}
      onClick={() => {}}
      onDateChange={() => {}}
      onProgressChange={() => {}}
      onTasksChange={() => {}}
    />
  );
};
