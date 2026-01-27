# Data Architecture - JSON-Driven Approach

## Overview

The application uses a **JSON-first, data-driven architecture** that supports multiple data sources while keeping components source-agnostic.

## Core Principle

**Components accept JSON data and don't care about the data source.**

All data sources (API, cron jobs, static files) return consistent JSON structures that components can consume directly.

## Data Source Types

### 1. API (REST Endpoints)

**Use Case**: Real-time data from REST APIs

**Implementation**:
- Uses `apiClient` for HTTP requests
- Returns `ApiResponse<T>` structure
- Supports GET, POST, PUT, DELETE
- Includes error handling and timeouts

**Example**:
```typescript
const response = await apiClient.get<DashboardData>('/api/dashboard/conference-room');
```

### 2. Cron Jobs

**Use Case**: Data pulled periodically from external sources (Jira, external APIs)

**Implementation**:
- Cron jobs fetch data and store in API endpoints
- Components fetch from these endpoints
- Data is pre-processed by cron jobs
- Supports scheduled refreshes

**Example**:
- Cron job pulls Jira tickets every 5 minutes
- Stores in `/api/jira/tickets`
- Components fetch from this endpoint

### 3. Static Data

**Use Case**: Configuration, constants, or rarely-changing data

**Implementation**:
- Loaded from static JSON files or constants
- Cached in memory
- No API calls needed
- Fast and reliable

**Example**:
```typescript
const staticData = await staticDataService.fetch(config);
```

### 4. Jira Integration

**Use Case**: Jira data for dashboards

**Implementation**:
- Uses cron service pattern
- Cron job fetches from Jira API
- Stores in application endpoints
- Components consume as JSON

## Data Service Factory

The `dataSourceFactory` routes requests to the appropriate service:

```typescript
const service = createDataService('api'); // or 'cron', 'static', 'jira'
const result = await service.fetch(config);
```

**Benefits**:
- Single interface for all data sources
- Easy to add new source types
- Consistent return structure
- Components don't need to know the source

## Component Data Flow

### JSON-First Design

Components receive data as JSON props:

```typescript
interface DashboardProps {
  roomName: string;
  config?: DashboardConfig;
  data?: Record<string, unknown>; // JSON data
}
```

### Widget Configuration

Widgets are defined via JSON configuration:

```typescript
interface WidgetConfig {
  id: string;
  type: WidgetType;
  dataSource: DataSourceType;
  config?: Record<string, unknown>;
}
```

### Flexible Rendering

Components can render any widget type based on JSON config:

```typescript
const TVDashboard = ({ config, data }: DashboardProps) => {
  // Render widgets based on config.widgets array
  // Each widget receives its data from data prop
  // Component doesn't care if data came from API, cron, or static
};
```

## Data Caching Strategy

### API Data
- Cache with TTL (Time To Live)
- Refresh based on `refreshInterval` config
- Store in Zustand for app-wide access

### Cron Data
- Cache until next cron run
- Refresh based on cron schedule
- May have longer cache times

### Static Data
- Cache indefinitely
- Only refresh on app restart or manual update
- Fastest access

## Type Safety

All data sources return typed structures:

```typescript
interface DataServiceResult<T> {
  data: T;
  source: DataSourceType;
  timestamp: string;
  cached?: boolean;
}
```

## Benefits of This Architecture

### 1. Flexibility
- Easy to add new data sources
- Components work with any source
- No component changes needed when source changes

### 2. Performance
- Appropriate caching per source type
- Static data is fastest
- API data can be cached with TTL

### 3. Maintainability
- Clear separation of concerns
- Data fetching logic isolated
- Components focus on rendering

### 4. Testability
- Easy to mock data sources
- Components can be tested with JSON fixtures
- Services can be tested independently

### 5. Scalability
- Can handle large datasets
- Efficient caching strategies
- Supports multiple concurrent data sources

## Implementation Example

### Setting Up a New Data Source

1. **Define the source type**:
```typescript
type DataSourceType = 'api' | 'cron' | 'static' | 'jira' | 'new-source';
```

2. **Create the service**:
```typescript
class NewDataService implements DataService {
  async fetch<T>(config: DataSourceConfig): Promise<DataServiceResult<T>> {
    // Implementation
  }
}
```

3. **Add to factory**:
```typescript
case 'new-source':
  return new NewDataService();
```

4. **Use in components**:
```typescript
const service = createDataService('new-source');
const data = await service.fetch(config);
```

## Best Practices

### For Components
- Accept JSON data as props
- Don't make assumptions about data source
- Handle loading and error states
- Use TypeScript for type safety

### For Services
- Return consistent JSON structure
- Include metadata (source, timestamp, cached)
- Handle errors gracefully
- Implement appropriate caching

### For Configuration
- Define widget configs as JSON
- Support flexible widget types
- Allow runtime configuration
- Validate config schemas

## Summary

The JSON-driven architecture provides:
- **Source-agnostic components** that work with any data
- **Flexible data sources** (API, cron, static, Jira)
- **Consistent interfaces** across all sources
- **Type-safe** data handling
- **Performance optimized** with appropriate caching
- **Easy to extend** with new data sources

**Key Takeaway**: Components consume JSON, services provide JSON, and the source doesn't matter.
