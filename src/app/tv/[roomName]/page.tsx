import type { TVRouteParams } from '@/types';
import { TVDashboard } from '@/components';

interface TVRoomPageProps {
  params: Promise<TVRouteParams>;
}

export default async function TVRoomPage({ params }: TVRoomPageProps) {
  const { roomName } = await params;
  return <TVDashboard roomName={roomName} />;
}
