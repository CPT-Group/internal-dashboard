# Dashboard Planning & Architecture

## Overview

Internal TV dashboard application for displaying team analytics, metrics, and data visualizations on office TVs (24/7 operation).

## Access & Deployment

- **Access Control**: IP-restricted to internal IPs only
- **TVs**: 5-7 TVs throughout the office
- **Operation**: 24/7 continuous display
- **Navigation**: TVs navigate directly to specific routes

## Route Structure

### Specific Routes (Unique Content)
- `/tv/dev-corner-one` - Dev team dashboard #1
- `/tv/dev-corner-two` - Dev team dashboard #2

### Generic Routes (Shared Content)
- `/tv/lobby` - Lobby dashboard
- `/tv/conference-room` - Conference room dashboard
- `/tv/break-room` - Break room dashboard

### Home Route
- `/` - Dashboard selector (card-based navigation)

## Home Page Design

### Purpose
Simple, TV-friendly navigation page with large, centered cards/buttons for each dashboard.

### Design Requirements
- **Centered layout** - Perfect alignment for TV viewing
- **Large touch targets** - Easy to click/navigate on TV
- **High contrast** - Use theme colors, don't override
- **Ripple effects** - Use PrimeReact ripple for visual feedback
- **Card-based** - Each dashboard as a card with icon, title, description

### Implementation Plan

```typescript
// Home page structure
- Full-screen centered container
- Grid of Card components (PrimeReact)
- Each card:
  - Icon (PrimeIcons)
  - Title (dashboard name)
  - Description (short summary)
  - Ripple effect on click
  - Navigate to /tv/{roomName}
- Responsive grid (2-3 columns on large screens)
- Use theme colors only
```

### Card Layout Example
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Dev Corner 1  │  │   Dev Corner 2  │  │     Lobby       │
│   📊 Analytics   │  │   📊 Analytics   │  │   📈 Metrics    │
│                 │  │                 │  │                 │
│  View Dashboard │  │  View Dashboard │  │  View Dashboard │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Dev Dashboard Structure

### Purpose
Display development team metrics, Jira data, sprint analytics, and team performance indicators.

### Data Sources
- Jira API (via cron jobs)
- Internal APIs
- Database queries
- Static analytics

### Widget Types Needed

#### 1. **Stats Cards** (Top Row)
- Tickets Completed Today
- Hours Logged Today
- Bugs Created This Sprint
- Active Tickets

#### 2. **Charts** (Middle Section)
- Sprint Progress (ProgressBar/Chart)
- Ticket Status Distribution (Pie/Donut Chart)
- Daily Hours Trend (Line Chart)
- Bug Trend Over Time (Line Chart)

#### 3. **Data Tables** (Bottom Section)
- Recent Tickets (DataTable)
- Top Contributors (DataTable)
- Sprint Summary (Card with stats)

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Dev Corner One Dashboard                               │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │ 42   │  │ 8.5h │  │  12  │  │ 156  │              │
│  │Tickets│  │Hours │  │ Bugs │  │Active│              │
│  └──────┘  └──────┘  └──────┘  └──────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Sprint Progress  │  │ Ticket Status    │          │
│  │   [Chart]        │  │   [Pie Chart]    │          │
│  └──────────────────┘  └──────────────────┘          │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Hours Trend      │  │ Bug Trend        │          │
│  │   [Line Chart]   │  │   [Line Chart]   │          │
│  └──────────────────┘  └──────────────────┘          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐        │
│  │ Recent Tickets                            │        │
│  │ [DataTable with pagination]               │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Data Structure (Dev Dashboard)

```typescript
interface DevDashboardData {
  stats: {
    ticketsCompletedToday: number;
    hoursLoggedToday: number;
    bugsCreatedThisSprint: number;
    activeTickets: number;
  };
  charts: {
    sprintProgress: {
      completed: number;
      inProgress: number;
      todo: number;
      total: number;
    };
    ticketStatusDistribution: Array<{
      status: string;
      count: number;
      color?: string;
    }>;
    dailyHoursTrend: Array<{
      date: string;
      hours: number;
    }>;
    bugTrend: Array<{
      date: string;
      bugs: number;
    }>;
  };
  recentTickets: Array<{
    id: string;
    title: string;
    assignee: string;
    status: string;
    priority: string;
    created: string;
  }>;
  topContributors: Array<{
    name: string;
    ticketsCompleted: number;
    hoursLogged: number;
  }>;
}
```

## Generic Dashboard Structure

### Purpose
Display case analytics, network metrics, database stats, API call data, and general business metrics.

### Data Sources
- Salesforce API
- Internal network monitoring
- Database queries
- API analytics
- Jira (case-related)
- Multiple external sources

### Widget Types Needed

#### 1. **Stats Cards** (Top Row)
- Total Cases Open
- Cases Resolved Today
- API Calls Today
- Database Queries Today
- Network Uptime

#### 2. **Charts** (Middle Section)
- Case Status Distribution (Pie Chart)
- Case Resolution Trend (Line Chart)
- API Call Volume (Bar Chart)
- Database Performance (Line Chart)

#### 3. **Data Tables** (Bottom Section)
- Recent Cases (DataTable)
- API Performance Metrics (DataTable)
- System Health Status (Card grid)

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Lobby Dashboard                                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │
│  │ 234  │  │  45  │  │ 12.5K│  │ 8.2K │  │ 99.9%│   │
│  │Cases │  │Resolved│ │ API  │  │  DB  │  │Uptime│   │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Case Status      │  │ Resolution Trend │          │
│  │   [Pie Chart]    │  │   [Line Chart]   │          │
│  └──────────────────┘  └──────────────────┘          │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │ API Call Volume  │  │ DB Performance   │          │
│  │   [Bar Chart]    │  │   [Line Chart]   │          │
│  └──────────────────┘  └──────────────────┘          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐        │
│  │ Recent Cases                              │        │
│  │ [DataTable with pagination]               │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Data Structure (Generic Dashboard)

```typescript
interface GenericDashboardData {
  stats: {
    totalCasesOpen: number;
    casesResolvedToday: number;
    apiCallsToday: number;
    databaseQueriesToday: number;
    networkUptime: number; // percentage
  };
  charts: {
    caseStatusDistribution: Array<{
      status: string;
      count: number;
      color?: string;
    }>;
    caseResolutionTrend: Array<{
      date: string;
      resolved: number;
    }>;
    apiCallVolume: Array<{
      hour: string;
      calls: number;
    }>;
    databasePerformance: Array<{
      time: string;
      queryTime: number; // ms
    }>;
  };
  recentCases: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    created: string;
    assignedTo: string;
  }>;
  apiMetrics: Array<{
    endpoint: string;
    calls: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
  systemHealth: {
    network: 'healthy' | 'warning' | 'critical';
    database: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
  };
}
```

## Component Organization

### Home Page Components
```
src/components/pages/
├── HomePage/
│   ├── HomePage.tsx              # Main home page
│   ├── DashboardCard.tsx         # Individual dashboard card
│   └── index.ts
```

### Dashboard Components
```
src/components/pages/
├── TVDashboard/
│   ├── TVDashboard.tsx           # Main dashboard container
│   ├── DashboardHeader.tsx       # Dashboard title/header
│   ├── WidgetGrid.tsx            # Grid layout for widgets
│   └── index.ts
├── widgets/
│   ├── StatsCard.tsx              # Stat card widget
│   ├── ChartWidget.tsx           # Chart wrapper widget
│   ├── DataTableWidget.tsx       # DataTable widget
│   ├── ProgressWidget.tsx        # Progress bar widget
│   └── index.ts
```

### Layout Components
```
src/components/layout/
├── TVLayout.tsx                   # TV-optimized layout wrapper
└── index.ts
```

## Widget Types

### 1. StatsCard Widget
- Large number display
- Label/description
- Optional icon
- Color-coded (use theme)
- Ripple effect

### 2. Chart Widget
- Wrapper for PrimeReact Chart
- Supports: bar, line, pie, donut
- Configurable via widget config
- Responsive sizing

### 3. DataTable Widget
- PrimeReact DataTable
- Pagination
- Sorting
- Filtering (optional)
- Customizable columns

### 4. Progress Widget
- ProgressBar or custom progress
- Label and percentage
- Color-coded status

## TV-Friendly Design Guidelines

### Layout
- **Centered content** - Use flexbox/grid with center alignment
- **Large fonts** - Minimum 16px, prefer 18-24px for readability
- **Spacing** - Generous padding/margins (p-4, p-5, gap-4)
- **Grid system** - Use PrimeFlex grid utilities
- **Full viewport** - Use full height/width appropriately

### Colors & Contrast
- **Use theme variables** - `var(--text-color)`, `var(--surface-ground)`, etc.
- **High contrast** - Ensure text is readable on backgrounds
- **Don't override** - Only add styles when absolutely necessary
- **Severity colors** - Use PrimeReact severity system (success, warning, danger, info)

### Interactions
- **Ripple effects** - Add `Ripple` component to interactive elements
- **Hover states** - Subtle hover effects for cards/buttons
- **Loading states** - Show loading spinners/skeletons
- **Error states** - Clear error messages

### Typography
- **Font sizes** - Use theme font sizes, scale up for TV if needed
- **Font weights** - Use bold for headings, regular for body
- **Line height** - Adequate line height for readability

## Data Flow

### Static Data (Development)
Create static TypeScript files for dummy data:

```
src/services/data/static/
├── devDashboardData.ts
├── genericDashboardData.ts
└── index.ts
```

### Data Service Integration
- Use existing `dataSourceFactory`
- Support 'api', 'cron', 'static' sources
- Components receive JSON data
- No component changes when source changes

## Implementation Phases

### Phase 1: Home Page
1. Create `HomePage` component
2. Create `DashboardCard` component
3. Add navigation to `/tv/{roomName}`
4. Style with PrimeReact Card, Button, Ripple
5. Use theme colors only

### Phase 2: Dev Dashboard (dev-corner-one)
1. Create dashboard layout structure
2. Implement StatsCard widget
3. Implement ChartWidget (start with one chart type)
4. Add static data for development
5. Style for TV viewing

### Phase 3: Dev Dashboard (dev-corner-two)
1. Reuse components from dev-corner-one
2. Different widget configuration
3. Different data/metrics focus

### Phase 4: Generic Dashboard (lobby)
1. Create generic dashboard layout
2. Implement additional widget types if needed
3. Add case/API/DB metrics
4. Style for TV viewing

### Phase 5: Generic Dashboard (conference-room)
1. Reuse lobby components
2. Same layout, different data focus

### Phase 6: Data Integration
1. Connect to real API endpoints
2. Set up cron job data sources
3. Replace static data with live data
4. Add error handling and loading states

## Next Steps

1. **Start with Home Page** - Simple, focused, gets navigation working
2. **Build one complete dashboard** - Dev-corner-one as the template
3. **Create reusable widgets** - StatsCard, ChartWidget, etc.
4. **Use static data first** - Get UI/UX right before data integration
5. **Iterate and refine** - TV viewing is different, test on actual TV if possible

## Key Principles

1. **TV-First Design** - Everything optimized for TV viewing
2. **Theme Respect** - Don't override theme unless absolutely necessary
3. **Component Reusability** - Build widgets that work for all dashboards
4. **Data Agnostic** - Components don't care about data source
5. **Type Safety** - Full TypeScript, no `any` or `unknown`
6. **Performance** - Efficient rendering, proper memoization
7. **Ripple Effects** - Use PrimeReact Ripple for all interactive elements
