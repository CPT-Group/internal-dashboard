import type { DataSourceType } from '@/types';

export interface DataServiceResult<T = unknown> {
  data: T;
  source: DataSourceType;
  timestamp: string;
  cached?: boolean;
}

export interface DataService {
  fetch<T = unknown>(config: unknown): Promise<DataServiceResult<T>>;
}
