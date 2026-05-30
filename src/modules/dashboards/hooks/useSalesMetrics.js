import { useQuery } from '@tanstack/react-query';
import { fetchSalesMetrics } from '../dashboardsApi.js';

export function useSalesMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-sales'],
    queryFn: fetchSalesMetrics,
    staleTime: 60000,
  });
  return { data, isLoading, error };
}
