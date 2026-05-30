import { useQuery } from '@tanstack/react-query';
import { fetchExecutiveMetrics } from '../dashboardsApi.js';

export function useExecutiveMetrics(range) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-exec', range],
    queryFn: () => fetchExecutiveMetrics(range.from, range.to),
    staleTime: 60000,
  });
  return { data, isLoading, error };
}
