import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCompanies,
  fetchCompany,
  createCompany,
  updateCompany,
} from "../../../lib/crmApi.js";

export function useCompanies(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["companies", filters],
    queryFn: () => fetchCompanies(filters),
    staleTime: 30000,
  });

  return {
    companies: data?.data ?? [],
    total: data?.count ?? 0,
    isLoading,
    error,
  };
}

export function useCompany(id) {
  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchCompany(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { company, isLoading };
}

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateCompany(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["company", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
