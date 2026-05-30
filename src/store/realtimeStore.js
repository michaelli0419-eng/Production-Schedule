import { create } from 'zustand';

export const useRealtimeStore = create((set, get) => ({
  channels: {},

  setChannelStatus: (name, status) =>
    set((state) => ({ channels: { ...state.channels, [name]: status } })),

  isConnected: (name) => get().channels[name] === 'connected',
}));
