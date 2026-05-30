import { create } from 'zustand';

let counter = 0;

export const useAppStore = create((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),

  badgeCounts: { materials: 0, aiIntake: 0, webhooks: 0 },
  setBadgeCount: (key, n) =>
    set((state) => ({ badgeCounts: { ...state.badgeCounts, [key]: n } })),

  activeModal: null,
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),

  globalLoading: false,
  setGlobalLoading: (bool) => set({ globalLoading: bool }),

  notifications: [],
  pushNotification: ({ type, message, ttl }) => {
    const id = counter++;
    set((state) => ({
      notifications: [...state.notifications, { id, type, message, ttl }],
    }));
    return id;
  },
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
