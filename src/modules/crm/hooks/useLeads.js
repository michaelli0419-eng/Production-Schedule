import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLeads,
  fetchLead,
  createLead,
  updateLead,
  convertLeadToOpportunity,
} from "../../../lib/crmApi.js";

export function useLeads(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => fetchLeads(filters),
    staleTime: 30000,
  });

  return {
    leads: data?.data ?? [],
    total: data?.count ?? 0,
    isLoading,
    error,
  };
}

export function useLead(id) {
  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => fetchLead(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { lead, isLoading };
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => convertLeadToOpportunity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities_kanban"] });
    },
  });
}
