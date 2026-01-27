import { apiClient } from '../apiClient';
import type { ApiResponse } from '@/types';

export const dashboardApi = {
  getDashboardData: async <T = unknown>(roomName: string): Promise<ApiResponse<T>> => {
    return apiClient.get<T>(`/api/dashboard/${roomName}`);
  },

  getWidgetData: async <T = unknown>(widgetId: string): Promise<ApiResponse<T>> => {
    return apiClient.get<T>(`/api/widgets/${widgetId}`);
  },
};
