import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createQuote, updateQuote, createQuoteRevision } from '../../../lib/quotingApi.js';

export function useSaveQuote() {
  const queryClient = useQueryClient();

  const saveQuote = useMutation({
    mutationFn: ({ id, payload }) => (id ? updateQuote(id, payload) : createQuote(payload)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote', data.id] });
    },
  });

  const saveRevision = useMutation({
    mutationFn: ({ quoteId, changeSummary, snapshot }) => createQuoteRevision(quoteId, changeSummary, snapshot),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  return { saveQuote, saveRevision };
}
