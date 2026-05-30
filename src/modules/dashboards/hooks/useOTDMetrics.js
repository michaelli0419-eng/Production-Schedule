import { useQuery } from '@tanstack/react-query';
import { fetchOTDMetrics } from '../dashboardsApi.js';

export function useOTDMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-otd'],
    queryFn: fetchOTDMetrics,
    staleTime: 60000,
  });
  return { data, isLoading, error };
}
