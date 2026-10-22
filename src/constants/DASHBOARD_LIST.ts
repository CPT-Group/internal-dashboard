export interface DashboardSplitOption {
  label: string;
  route: string;
  icon: string;
}

export interface DashboardItem {
  title: string;
  description: string;
  route: string;
  icon: string;
  /**
   * Optional card variant for special styling/behavior:
   * - 'unicorn': Julie's Office sparkle gradient (legacy, pre-split-group).
   * - 'splitGroup': renders as a PrimeReact SplitButton — clicking the face
   *   navigates to `route` (the default), the dropdown arrow opens `splitOptions`.
   */
  variant?: 'unicorn' | 'splitGroup';
  /** Required when variant is 'splitGroup' — the non-default destinations shown in the dropdown. */
  splitOptions?: DashboardSplitOption[];
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
    title: 'Executive Offices',
    description: "Julie, Jackie & Mark's personal TV dashboards",
    // Default face-click destination: Julie (President).
    route: '/tv/julie',
    icon: 'pi pi-building',
    variant: 'splitGroup',
    splitOptions: [
      { label: "Julie's Office", route: '/tv/julie', icon: 'pi pi-star' },
      { label: "Jackie's Office", route: '/tv/jackie', icon: 'pi pi-briefcase' },
      { label: "Mark's Office", route: '/tv/mark', icon: 'pi pi-dollar' },
    ],
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
