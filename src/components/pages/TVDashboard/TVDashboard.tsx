'use client';

import dynamic from 'next/dynamic';
import type { DashboardProps } from '@/types';
import { ConferenceRoomDashboard } from '@/components/pages/ConferenceRoomDashboard';
import { JuliesOfficeDashboard } from '@/components/pages/JuliesOfficeDashboard';

const TrevorDashboard = dynamic(
  () => import('@/components/pages/TrevorDashboard').then((m) => m.TrevorDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

const OperationalJiraDashboard = dynamic(
  () => import('@/components/pages/OperationalJiraDashboard').then((m) => m.OperationalJiraDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

export const TVDashboard = ({ roomName, config, data }: DashboardProps) => {
  if (roomName === 'dev-corner-one' || roomName === 'dev-corner-two') {
    return <OperationalJiraDashboard />;
  }
  if (roomName === 'conference-room') {
    return <ConferenceRoomDashboard />;
  }
  if (roomName === 'trevor') {
    return <TrevorDashboard />;
  }
  if (roomName === 'break-room') {
    return <JuliesOfficeDashboard />;
  }
  return null;
};
