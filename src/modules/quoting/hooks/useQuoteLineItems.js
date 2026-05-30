import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceQuoteLineItems, updateQuote } from '../../../lib/quotingApi.js';

export function useQuoteLineItems(quoteId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, totals }) => {
      await replaceQuoteLineItems(quoteId, items);
      return updateQuote(quoteId, totals);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}
