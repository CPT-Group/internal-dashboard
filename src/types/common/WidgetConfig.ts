import type { DataSourceType } from './DataSource';

export type WidgetType = 'stats' | 'heatmap' | 'chart' | 'table' | 'metric' | 'custom';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  dataSource: DataSourceType;
  config?: Record<string, unknown>;
  layout?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

export interface DashboardConfig {
  roomName: string;
  widgets: WidgetConfig[];
}
