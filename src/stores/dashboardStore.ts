import { create } from 'zustand';

interface DashboardState {
  selectedRoom: string | null;
  dashboardData: Record<string, unknown>;
  isLoading: boolean;
  lastUpdated: string | null;
  setSelectedRoom: (roomName: string | null) => void;
  setDashboardData: (data: Record<string, unknown>) => void;
  setLoading: (loading: boolean) => void;
  updateLastUpdated: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedRoom: null,
  dashboardData: {},
  isLoading: false,
  lastUpdated: null,
  setSelectedRoom: (roomName) => set({ selectedRoom: roomName }),
  setDashboardData: (data) => set({ dashboardData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateLastUpdated: () => set({ lastUpdated: new Date().toISOString() }),
}));
