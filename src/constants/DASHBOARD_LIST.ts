export interface DashboardItem {
  title: string;
  description: string;
  route: string;
  icon: string;
  /** Optional card variant for special styling (e.g. 'unicorn' for Julie's Office). */
  variant?: 'unicorn';
  enabled: boolean;
}

export const DASHBOARD_LIST: DashboardItem[] = [
  {
    title: 'NOVA Daily',
    description: 'NOVA team TV — KPIs, work hours, throughput & activity',
    route: '/tv/dev-corner-one',
    icon: 'pi pi-code',
    enabled: true,
  },
  {
    title: 'GitHub activity',
    description: 'Org/repo webhooks · feed & Teams mirror',
    route: '/tv/dev-corner-two',
    icon: 'pi pi-github',
    enabled: true,
  },
  {
    title: 'Conference Room',
    description: 'Main conference room dashboard',
    route: '/tv/conference-room',
    icon: 'pi pi-users',
    enabled: true,
  },
  {
    title: "Trevor's Screen",
    description: 'Dev team totals & Gantt – mobile-friendly',
    route: '/tv/trevor',
    icon: 'pi pi-chart-bar',
    /** Hidden from home grid; `/tv/trevor` remains bookmarkable. */
    enabled: false,
  },
  {
    title: "Jackie's Office",
    description: 'Dashboard for case manager operations',
    route: '/tv/jackie',
    icon: 'pi pi-briefcase',
    enabled: true,
  },
  {
    title: "Julie's Office",
    description: 'President’s dashboard',
    route: '/tv/julie',
    icon: 'pi pi-star',
    variant: 'unicorn',
    enabled: true,
  },
  {
    title: 'Website Health',
    description: 'Interactive / production DB analytics (in development)',
    route: '/website-health',
    icon: 'pi pi-heart',
    enabled: true,
  },
  {
    title: 'Cursor analytics',
    description: 'Local CSV summary — month, repo, developer (no Cursor API calls)',
    route: '/cursor-analytics',
    icon: 'pi pi-chart-line',
    enabled: true,
  },
];
