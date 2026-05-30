import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProductionJob, fetchProductionJobs, updateProductionJob } from '../../../lib/productionApi.js';

export function useProductionJobs(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['production-jobs', filters],
    queryFn: () => fetchProductionJobs(filters),
    staleTime: 30000,
  });

  return { jobs: data ?? [], isLoading, error };
}

export function useJob(id) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['production-job', id],
    queryFn: () => fetchProductionJob(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { job: data, isLoading, error };
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateProductionJob(id, data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['production-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['production-job', job.id] });
    },
  });
}
