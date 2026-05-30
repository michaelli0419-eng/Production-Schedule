import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCapacityBlock, fetchCapacityData, upsertCapacityRule } from '../../../lib/capacityApi.js';

export function useCapacityData() {
  const query = useQuery({
    queryKey: ['capacity-data'],
    queryFn: fetchCapacityData,
    staleTime: 30000,
  });

  const data = useMemo(() => ({
    departments: query.data?.departments ?? [],
    rules: query.data?.rules ?? [],
    blocks: query.data?.blocks ?? [],
    routingSteps: query.data?.routingSteps ?? [],
  }), [query.data]);

  return { ...data, isLoading: query.isLoading, error: query.error };
}

export function useSaveCapacityRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertCapacityRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-data'] }),
  });
}

export function useCreateCapacityBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCapacityBlock,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['capacity-data'] }),
  });
}
