import { useQuery } from '@tanstack/react-query';
import { fetchSalesMetrics } from '../dashboardsApi.js';

export function useRevenueForecast() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dash-revenue-forecast'],
    queryFn: fetchSalesMetrics,
    staleTime: 60000,
  });
  return {
    forecast: data?.byStage || [],
    weighted: data?.weightedValue || 0,
    total: data?.totalValue || 0,
    isLoading,
    error,
  };
}
