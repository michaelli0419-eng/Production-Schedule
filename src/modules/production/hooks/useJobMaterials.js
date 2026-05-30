import { useQuery } from '@tanstack/react-query';
import { fetchJobMaterials } from '../../../lib/productionApi.js';

export function useJobMaterials(jobId) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['job-materials', jobId],
    queryFn: () => fetchJobMaterials(jobId),
    enabled: !!jobId,
    staleTime: 30000,
  });

  return { materials: data ?? [], isLoading, error };
}
