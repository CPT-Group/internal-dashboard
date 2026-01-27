import type { TVRouteParams } from '@/types';

interface TVRoomPageProps {
  params: Promise<TVRouteParams>;
}

export default async function TVRoomPage({ params }: TVRoomPageProps) {
  const { roomName } = await params;
  return null;
}
