import { TV_ROUTE_CONFIGS, type TVRoomName } from '@/constants';

export const isValidTVRoom = (roomName: string): roomName is TVRoomName => {
  return roomName in TV_ROUTE_CONFIGS;
};

export const getTVRouteConfig = (roomName: string) => {
  if (!isValidTVRoom(roomName)) {
    return null;
  }
  return TV_ROUTE_CONFIGS[roomName];
};
