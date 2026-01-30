'use client';

import type { DashboardProps } from '@/types';
import { NovaDashboard } from '@/components';

export const TVDashboard = ({ roomName, config, data }: DashboardProps) => {
  if (roomName === 'dev-corner-two') {
    return <NovaDashboard />;
  }
  return null;
};
