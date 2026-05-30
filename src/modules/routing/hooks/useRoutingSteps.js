import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoutingStep, deleteRoutingStep, updateRoutingStep } from '../../../lib/routingApi.js';

export function useRoutingSteps(templateId) {
  const queryClient = useQueryClient();

  const createStep = useMutation({
    mutationFn: createRoutingStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing-template', templateId] }),
  });

  const saveStep = useMutation({
    mutationFn: ({ id, payload }) => updateRoutingStep(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing-template', templateId] }),
  });

  const removeStep = useMutation({
    mutationFn: deleteRoutingStep,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routing-template', templateId] }),
  });

  return { createStep, saveStep, removeStep };
}
