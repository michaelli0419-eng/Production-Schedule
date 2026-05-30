import { useQuery } from '@tanstack/react-query';
import { fetchProductionMetrics } from '../dashboardsApi.js';

export function useProductionMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-production'],
    queryFn: fetchProductionMetrics,
    staleTime: 60000,
  });
  return { data, isLoading, error };
}
