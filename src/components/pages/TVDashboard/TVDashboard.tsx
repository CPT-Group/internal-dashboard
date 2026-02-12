'use client';

import dynamic from 'next/dynamic';
import type { DashboardProps } from '@/types';
import { ConferenceRoomDashboard } from '@/components/pages/ConferenceRoomDashboard';

const NovaDashboard = dynamic(
  () => import('@/components/pages/DevCornerTwoDashboard').then((m) => m.NovaDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

const TrevorDashboard = dynamic(
  () => import('@/components/pages/TrevorDashboard').then((m) => m.TrevorDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

export const TVDashboard = ({ roomName, config, data }: DashboardProps) => {
  if (roomName === 'dev-corner-two') {
    return <NovaDashboard />;
  }
  if (roomName === 'conference-room') {
    return <ConferenceRoomDashboard />;
  }
  if (roomName === 'trevor') {
    return <TrevorDashboard />;
  }
  return null;
};
