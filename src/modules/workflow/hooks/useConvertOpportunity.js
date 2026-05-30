import { useMutation, useQueryClient } from '@tanstack/react-query';
import { convertOpportunityToJob } from '../../../lib/workflowApi.js';

export function useConvertOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertOpportunityToJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion-queue'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities_kanban'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
