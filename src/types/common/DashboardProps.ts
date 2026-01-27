import type { DashboardConfig } from './WidgetConfig';

export interface DashboardProps {
  roomName: string;
  config?: DashboardConfig;
  data?: Record<string, unknown>;
}
