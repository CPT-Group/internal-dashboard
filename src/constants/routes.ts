import type { TVRouteConfig } from '@/types';

export const TV_ROOM_NAMES = [
  'dev-corner-one',
  'dev-corner-two',
  'conference-room',
  'trevor',
  'lobby',
  'break-room',
] as const;

export type TVRoomName = (typeof TV_ROOM_NAMES)[number];

export const TV_ROUTE_CONFIGS: Record<string, TVRouteConfig> = {
  'dev-corner-one': {
    roomName: 'dev-corner-one',
    displayName: 'Dev Corner One',
    description: 'Development team dashboard - Analytics & Metrics',
    enabled: true,
  },
  'dev-corner-two': {
    roomName: 'dev-corner-two',
    displayName: 'Dev Corner Two',
    description: 'Development team dashboard - Performance & Stats',
    enabled: true,
  },
  'conference-room': {
    roomName: 'conference-room',
    displayName: 'Conference Room',
    description: 'Main conference room dashboard',
    enabled: true,
  },
  trevor: {
    roomName: 'trevor',
    displayName: "Trevor's Screen",
    description: 'Dev team totals & Gantt – mobile-friendly',
    enabled: true,
  },
  lobby: {
    roomName: 'lobby',
    displayName: 'Lobby',
    description: 'Lobby dashboard - Case analytics & system metrics',
    enabled: true,
  },
  'break-room': {
    roomName: 'break-room',
    displayName: 'Break Room',
    description: 'Break room dashboard',
    enabled: true,
  },
};
