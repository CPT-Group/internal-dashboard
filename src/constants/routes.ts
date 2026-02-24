import type { TVRouteConfig } from '@/types';

export const TV_ROOM_NAMES = [
  'dev-corner-one',
  'dev-corner-two',
  'conference-room',
  'trevor',
  'jackie',
  'julie',
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
  jackie: {
    roomName: 'jackie',
    displayName: "Jackie's Office",
    description: 'Dashboard for case manager operations',
    enabled: true,
  },
  julie: {
    roomName: 'julie',
    displayName: "Julie's Office",
    description: "President's dashboard",
    enabled: true,
  },
};
