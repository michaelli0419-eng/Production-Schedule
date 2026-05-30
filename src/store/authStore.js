import { create } from 'zustand';

export const ROLES = {
  ADMIN: 'admin',
  ESTIMATOR: 'estimator',
  PM: 'pm',
  SALES: 'sales',
  PRODUCTION: 'production',
  EXECUTIVE: 'executive',
};

export const useAuthStore = create((set, get) => ({
  currentUser: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  clearCurrentUser: () => set({ currentUser: null }),

  isRole: (...roles) => {
    const { currentUser } = get();
    if (!currentUser || !currentUser.role) return false;
    return roles.some((r) => r.toLowerCase() === currentUser.role.toLowerCase());
  },
}));
