'use client';

import dynamic from 'next/dynamic';
import type { DashboardProps } from '@/types';

const NovaDashboard = dynamic(
  () => import('@/components/pages/DevCornerTwoDashboard').then((m) => m.NovaDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

export const TVDashboard = ({ roomName, config, data }: DashboardProps) => {
  if (roomName === 'dev-corner-two') {
    return <NovaDashboard />;
  }
  return null;
};
