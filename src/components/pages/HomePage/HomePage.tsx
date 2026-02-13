'use client';

import { useTheme } from '@/providers/ThemeProvider';
import { DashboardListView } from './DashboardListView';
import { DASHBOARD_LIST } from '@/constants/DASHBOARD_LIST';

export const HomePage = () => {
  const { theme, cycleTheme } = useTheme();

  return (
    <div className="home-page-container">
      <button
        type="button"
        onClick={cycleTheme}
        className="theme-switcher-sticky"
        title={`Theme: ${theme} (click to cycle)`}
        aria-label={`Cycle theme (current: ${theme})`}
      >
        {theme}
      </button>
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
