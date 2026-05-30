import { useQuery } from '@tanstack/react-query';
import { fetchCapacityMetrics } from '../dashboardsApi.js';

export function useCapacityMetrics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-capacity'],
    queryFn: fetchCapacityMetrics,
    staleTime: 60000,
  });
  return { data, isLoading, error };
}
