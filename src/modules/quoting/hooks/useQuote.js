import { useQuery } from '@tanstack/react-query';
import { fetchQuotes, fetchQuoteById } from '../../../lib/quotingApi.js';

export function useQuotes(filters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => fetchQuotes(filters),
    staleTime: 30000,
  });

  return { quotes: data?.data ?? [], total: data?.count ?? 0, isLoading, error };
}

export function useQuote(id) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => fetchQuoteById(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return { quote: data, isLoading, error };
}
