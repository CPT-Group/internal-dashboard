'use client';

import { DashboardCard } from './DashboardCard';
import type { DashboardItem } from '@/constants/DASHBOARD_LIST';

interface DashboardListViewProps {
  data: DashboardItem[];
}

export const DashboardListView = ({ data }: DashboardListViewProps) => {
  const enabledDashboards = data.filter((dashboard) => dashboard.enabled);

  return (
    <div className="grid">
      {enabledDashboards.map((dashboard) => (
        <div key={dashboard.route} className="col-12 md:col-6 lg:col-4">
          <DashboardCard
            title={dashboard.title}
            description={dashboard.description}
            route={dashboard.route}
            icon={dashboard.icon}
            variant={dashboard.variant}
          />
        </div>
      ))}
    </div>
  );
};
