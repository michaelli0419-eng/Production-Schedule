import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchActivities,
  createActivity,
  updateActivity,
  fetchTasks,
  createTask,
  updateTask,
} from "../../../lib/crmApi.js";

export function useCrmActivities({ entityType, entityId } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm_activities", entityType, entityId],
    queryFn: () => fetchActivities({ entityType, entityId }),
    enabled: true,
    staleTime: 30000,
  });

  return {
    activities: data?.data ?? [],
    total: data?.count ?? 0,
    isLoading,
    error,
  };
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createActivity,
    onSuccess: (_data, variables) => {
      // payload uses snake_case: entity_type, entity_id
      queryClient.invalidateQueries({
        queryKey: ["crm_activities", variables.entity_type, variables.entity_id],
      });
      // also bust the global feed
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateActivity(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crm_activities", variables.data?.entity_type, variables.data?.entity_id],
      });
      queryClient.invalidateQueries({ queryKey: ["crm_activities"] });
    },
  });
}

export function useCrmTasks({ entityType, entityId, status } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm_tasks", entityType, entityId, status],
    queryFn: () => fetchTasks({ entityType, entityId, status }),
    enabled: !!entityType && !!entityId,
    staleTime: 30000,
  });

  return {
    tasks: data?.data ?? [],
    total: data?.data?.length ?? 0,
    isLoading,
    error,
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crm_tasks", variables.entityType, variables.entityId],
      });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateTask(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crm_tasks", variables.entityType, variables.entityId],
      });
    },
  });
}
