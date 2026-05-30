import { useAuthStore } from '../store/authStore.js';

const PERMISSION_MAP = {
  view_prices: ['admin', 'estimator', 'executive'],
  approve_quotes: ['admin', 'executive'],
  convert_opportunity: ['admin', 'estimator', 'pm'],
  edit_schedule: ['admin', 'pm', 'production'],
  manage_users: ['admin'],
  view_financials: ['admin', 'executive', 'estimator'],
};

export function usePermission() {
  const role = useAuthStore((s) => s.currentUser?.role?.toLowerCase());

  function can(action) {
    const allowed = PERMISSION_MAP[action];
    if (!allowed) return false;
    return allowed.includes(role);
  }

  return {
    can,
    role,
    isAdmin: role === 'admin',
    isExecutive: role === 'executive',
    isProduction: role === 'production',
    isSales: role === 'sales',
    isEstimator: role === 'estimator',
    isPM: role === 'pm',
    canViewPrices: PERMISSION_MAP.view_prices.includes(role),
  };
}
