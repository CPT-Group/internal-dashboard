import type { DataService, DataServiceResult } from './types';
import type { DataSourceConfig } from '@/types';
import { apiClient } from '../api/apiClient';

export class CronDataService implements DataService {
  async fetch<T = unknown>(config: DataSourceConfig): Promise<DataServiceResult<T>> {
    // Cron data service - fetches from API endpoints that are populated by cron jobs
    // This could be Jira data, external APIs, etc.
    if (!config.endpoint) {
      throw new Error('Cron data service requires an endpoint');
    }

    const response = await apiClient.get<T>(config.endpoint);
    
    return {
      data: response.data,
      source: 'cron',
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }
}
