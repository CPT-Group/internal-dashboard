export interface DashboardItem {
  title: string;
  description: string;
  route: string;
  icon: string;
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
    title: 'Lobby',
    description: 'Lobby dashboard - Case analytics & system metrics',
    route: '/tv/lobby',
    icon: 'pi pi-building',
    enabled: true,
  },
  {
    title: 'Break Room',
    description: 'Break room dashboard',
    route: '/tv/break-room',
    icon: 'pi pi-home',
    enabled: true,
  },
];
