export type DataSourceType = 'api' | 'cron' | 'static' | 'jira';

export interface DataSourceConfig {
  type: DataSourceType;
  endpoint?: string;
  refreshInterval?: number;
  cacheKey?: string;
}
