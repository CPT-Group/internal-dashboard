declare module 'react-frappe-gantt' {
  import type { ComponentType } from 'react';

  export interface GanttTaskData {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    dependencies?: string;
  }

  export class Task {
    constructor(data: GanttTaskData);
  }

  export const ViewMode: {
    QuarterDay: string;
    HalfDay: string;
    Day: string;
    Week: string;
    Month: string;
  };

  export interface FrappeGanttProps {
    tasks: Task[];
    viewMode?: string;
    onClick?: (task: Task) => void;
    onDateChange?: (task: Task, start: unknown, end: unknown) => void;
    onProgressChange?: (task: Task, progress: number) => void;
    onTasksChange?: (tasks: Task[]) => void;
    onViewChange?: (mode: string) => void;
  }

  export const FrappeGantt: ComponentType<FrappeGanttProps>;
}
