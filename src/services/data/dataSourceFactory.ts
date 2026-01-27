import type { DataSourceConfig, DataSourceType } from '@/types';
import type { DataService } from './types';
import { StaticDataService } from './staticDataService';
import { CronDataService } from './cronDataService';
import { apiClient } from '../api/apiClient';

class ApiDataService implements DataService {
  async fetch<T = unknown>(config: DataSourceConfig): Promise<import('./types').DataServiceResult<T>> {
    if (!config.endpoint) {
      throw new Error('API data service requires an endpoint');
    }

    const response = await apiClient.get<T>(config.endpoint);
    
    return {
      data: response.data,
      source: 'api',
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }
}

export const createDataService = (type: DataSourceType): DataService => {
  switch (type) {
    case 'static':
      return new StaticDataService();
    case 'cron':
      return new CronDataService();
    case 'api':
      return new ApiDataService();
    case 'jira':
      // Jira would use cron service pattern
      return new CronDataService();
    default:
      throw new Error(`Unknown data source type: ${type}`);
  }
};
