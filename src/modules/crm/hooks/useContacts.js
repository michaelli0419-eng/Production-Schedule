import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchContacts,
  fetchContact,
  createContact,
  updateContact,
} from "../../../lib/crmApi.js";

export function useContacts(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["contacts", filters],
    queryFn: () => fetchContacts(filters),
    staleTime: 30000,
  });

  return {
    contacts: data?.data ?? [],
    total: data?.count ?? 0,
    isLoading,
    error,
  };
}

export function useContact(id) {
  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => fetchContact(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { contact, isLoading };
}

export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateContact(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contact", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
