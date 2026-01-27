import type { DataService, DataServiceResult } from './types';
import type { DataSourceConfig } from '@/types';

export class StaticDataService implements DataService {
  async fetch<T = unknown>(config: DataSourceConfig): Promise<DataServiceResult<T>> {
    // Static data service - returns mock/static JSON data
    // In production, this would load from static JSON files or constants
    return {
      data: {} as T,
      source: 'static',
      timestamp: new Date().toISOString(),
      cached: true,
    };
  }
}
