'use client';

import { FrappeGantt, Task, ViewMode } from 'react-frappe-gantt';

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
}

interface GanttChartProps {
  tasks: GanttTask[];
}

export const GanttChart = ({ tasks }: GanttChartProps) => {
  const ganttTasks = tasks.map((t) => new Task(t));
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
