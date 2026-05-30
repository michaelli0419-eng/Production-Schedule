import { useQuery } from '@tanstack/react-query';
import { fetchJobRoutingSteps } from '../../../lib/productionApi.js';

export function useJobRoutingSteps(jobId) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['job-routing-steps', jobId],
    queryFn: () => fetchJobRoutingSteps(jobId),
    enabled: !!jobId,
    staleTime: 30000,
  });

  return { routingSteps: data ?? [], isLoading, error };
}
