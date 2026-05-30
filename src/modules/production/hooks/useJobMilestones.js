import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJobMilestones, upsertJobMilestone } from '../../../lib/productionApi.js';

export function useJobMilestones(jobId) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['job-milestones', jobId],
    queryFn: () => fetchJobMilestones(jobId),
    enabled: !!jobId,
    staleTime: 30000,
  });

  return { milestones: data ?? [], isLoading, error };
}

export function useSaveMilestone(jobId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertJobMilestone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-milestones', jobId] }),
  });
}
