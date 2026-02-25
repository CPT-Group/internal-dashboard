'use client';

import dynamic from 'next/dynamic';
import type { DashboardProps } from '@/types';
import { usePageAutoRefresh } from '@/hooks';
import { ConferenceRoomDashboard } from '@/components/pages/ConferenceRoomDashboard';
import { JackiesOfficeDashboard } from '@/components/pages/JackiesOfficeDashboard';
import { JuliesOfficeDashboard } from '@/components/pages/JuliesOfficeDashboard';

const TrevorDashboard = dynamic(
  () => import('@/components/pages/TrevorDashboard').then((m) => m.TrevorDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

const OperationalJiraDashboard = dynamic(
  () => import('@/components/pages/OperationalJiraDashboard').then((m) => m.OperationalJiraDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

const DevCornerOneDashboard = dynamic(
  () => import('@/components/pages/DevCornerOneDashboard').then((m) => m.DevCornerOneDashboard),
  { ssr: false, loading: () => <div className="nova-dashboard-loading flex align-items-center justify-content-center min-h-screen" /> }
);

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export const TVDashboard = ({ roomName, config, data }: DashboardProps) => {
  usePageAutoRefresh(THREE_HOURS_MS);

  if (roomName === 'dev-corner-one') {
    return <DevCornerOneDashboard />;
  }
  if (roomName === 'dev-corner-two') {
    return <OperationalJiraDashboard />;
  }
  if (roomName === 'conference-room') {
    return <ConferenceRoomDashboard />;
  }
  if (roomName === 'trevor') {
    return <TrevorDashboard />;
  }
  if (roomName === 'jackie') {
    return <JackiesOfficeDashboard />;
  }
  if (roomName === 'julie') {
    return <JuliesOfficeDashboard />;
  }
  return null;
};
