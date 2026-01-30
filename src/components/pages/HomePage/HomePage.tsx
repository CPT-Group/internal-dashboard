'use client';

import { DashboardListView } from './DashboardListView';
import { DASHBOARD_LIST } from '@/constants/DASHBOARD_LIST';

export const HomePage = () => {
  return (
    <div className="home-page-container">
      <div className="w-full max-w-7xl">
        <div className="text-center mb-4">
          <h1 className="text-4xl font-bold m-0 mb-2">Internal Dashboard</h1>
          <p className="text-lg text-color-secondary m-0">Select a dashboard to view</p>
        </div>

        <DashboardListView data={DASHBOARD_LIST} />
      </div>
    </div>
  );
};
