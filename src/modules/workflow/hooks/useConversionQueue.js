import { useQuery } from '@tanstack/react-query';
import { fetchConversionQueue } from '../../../lib/workflowApi.js';

export function useConversionQueue() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['conversion-queue'],
    queryFn: fetchConversionQueue,
    staleTime: 30000,
  });

  return { queue: data ?? [], isLoading, error, refetch };
}
