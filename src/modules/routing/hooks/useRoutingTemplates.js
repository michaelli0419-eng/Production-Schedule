import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRoutingTemplate, fetchRoutingTemplate, fetchRoutingTemplates, updateRoutingTemplate } from '../../../lib/routingApi.js';

export function useRoutingTemplates() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['routing-templates'],
    queryFn: fetchRoutingTemplates,
    staleTime: 30000,
  });
  return { templates: data ?? [], isLoading, error };
}

export function useRoutingTemplate(id) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['routing-template', id],
    queryFn: () => fetchRoutingTemplate(id),
    enabled: !!id,
    staleTime: 30000,
  });
  return { template: data, isLoading, error };
}

export function useSaveRoutingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => (id ? updateRoutingTemplate(id, payload) : createRoutingTemplate(payload)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['routing-templates'] });
      queryClient.invalidateQueries({ queryKey: ['routing-template', data.id] });
    },
  });
}
