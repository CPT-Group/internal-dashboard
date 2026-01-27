import type { TVRouteConfig } from '@/types';

export const TV_ROOM_NAMES = [
  'conference-room',
  'dev',
  'lobby',
  'break-room',
] as const;

export type TVRoomName = (typeof TV_ROOM_NAMES)[number];

export const TV_ROUTE_CONFIGS: Record<string, TVRouteConfig> = {
  'conference-room': {
    roomName: 'conference-room',
    displayName: 'Conference Room',
    description: 'Main conference room dashboard',
    enabled: true,
  },
  dev: {
    roomName: 'dev',
    displayName: 'Development',
    description: 'Development team dashboard',
    enabled: true,
  },
  lobby: {
    roomName: 'lobby',
    displayName: 'Lobby',
    description: 'Lobby dashboard',
    enabled: true,
  },
  'break-room': {
    roomName: 'break-room',
    displayName: 'Break Room',
    description: 'Break room dashboard',
    enabled: true,
  },
};
