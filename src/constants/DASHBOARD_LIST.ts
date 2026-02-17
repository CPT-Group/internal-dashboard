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
    title: 'Dev Corner One',
    description: 'Development team dashboard - Analytics & Metrics',
    route: '/tv/dev-corner-one',
    icon: 'pi pi-code',
    enabled: true,
  },
  {
    title: 'Dev Corner Two',
    description: 'Development team dashboard - Performance & Stats',
    route: '/tv/dev-corner-two',
    icon: 'pi pi-chart-line',
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
    enabled: true,
  },
  {
    title: "Jackie's Office",
    description: 'Dashboard for case manager operations',
    route: '/tv/lobby',
    icon: 'pi pi-briefcase',
    enabled: true,
  },
  {
    title: "Julie's Office",
    description: 'President’s dashboard',
    route: '/tv/break-room',
    icon: 'pi pi-star',
    variant: 'unicorn',
    enabled: true,
  },
];
