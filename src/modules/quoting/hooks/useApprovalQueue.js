import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decideApproval, fetchApprovalQueue, upsertApprovalStep } from '../../../lib/quotingApi.js';

export function useApprovalQueue() {
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ['quote-approval-queue'],
    queryFn: fetchApprovalQueue,
    staleTime: 30000,
  });

  const addStep = useMutation({
    mutationFn: upsertApprovalStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote-approval-queue'] }),
  });

  const decide = useMutation({
    mutationFn: ({ id, status, comments }) => decideApproval(id, status, comments),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quote-approval-queue'] }),
  });

  return { queue: queue.data ?? [], isLoading: queue.isLoading, error: queue.error, addStep, decide };
}
