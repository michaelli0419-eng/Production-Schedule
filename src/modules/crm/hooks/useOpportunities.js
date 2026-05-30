import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOpportunities,
  fetchOpportunitiesByStage,
  fetchOpportunity,
  createOpportunity,
  updateOpportunity,
  moveOpportunityStage,
} from "../../../lib/crmApi.js";

export function useOpportunities(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["opportunities", filters],
    queryFn: () => fetchOpportunities(filters),
    staleTime: 30000,
  });

  return {
    opportunities: data?.data ?? [],
    total: data?.count ?? 0,
    isLoading,
    error,
  };
}

export function useOpportunitiesByStage() {
  const { data: kanban, isLoading, error } = useQuery({
    queryKey: ["opportunities_kanban"],
    queryFn: () => fetchOpportunitiesByStage(),
    staleTime: 30000,
  });

  return { kanban, isLoading, error };
}

export function useOpportunity(id) {
  const { data: opportunity, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => fetchOpportunity(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { opportunity, isLoading };
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOpportunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities_kanban"] });
    },
  });
}

export function useUpdateOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateOpportunity(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["opportunity", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities_kanban"] });
    },
  });
}

export function useMoveOpportunityStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, toStage, probability }) => moveOpportunityStage(id, toStage, probability),

    onMutate: async ({ id, fromStage, toStage, position }) => {
      if (String(id).startsWith('deal:')) return {};
      await queryClient.cancelQueries({ queryKey: ["opportunities_kanban"] });

      const previousKanban = queryClient.getQueryData(["opportunities_kanban"]);

      queryClient.setQueryData(["opportunities_kanban"], (old) => {
        if (!old) return old;

        const updated = { ...old };

        // Find the opportunity in the source stage
        const sourceList = updated[fromStage] ? [...updated[fromStage]] : [];
        const oppIndex = sourceList.findIndex((o) => o.id === id);
        if (oppIndex === -1) return old;

        const [movedOpp] = sourceList.splice(oppIndex, 1);
        const updatedOpp = { ...movedOpp, stage: toStage };

        const destList = updated[toStage] ? [...updated[toStage]] : [];
        const insertAt = position != null ? position : destList.length;
        destList.splice(insertAt, 0, updatedOpp);

        return {
          ...updated,
          [fromStage]: sourceList,
          [toStage]: destList,
        };
      });

      return { previousKanban };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousKanban !== undefined) {
        queryClient.setQueryData(["opportunities_kanban"], context.previousKanban);
      }
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities_kanban"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });
}
