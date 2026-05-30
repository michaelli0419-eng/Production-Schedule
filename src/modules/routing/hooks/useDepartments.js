import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from '../../../lib/routingApi.js';

export function useDepartments() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    staleTime: 30000,
  });

  return { departments: data ?? [], isLoading, error };
}
