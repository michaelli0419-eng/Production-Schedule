import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { convertDraftToEntity, fetchIntakeDrafts, parseIntakeDocument, updateIntakeDraft } from '../../../lib/aiIntakeApi.js';

export function useIntakeDrafts(status = 'all') {
  const { data, isLoading, error } = useQuery({
    queryKey: ['intake-drafts', status],
    queryFn: () => fetchIntakeDrafts(status),
    staleTime: 10000,
  });
  return { drafts: data ?? [], isLoading, error };
}

export function useParseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: parseIntakeDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake-drafts'] }),
  });
}

export function useUpdateDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => updateIntakeDraft(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake-drafts'] }),
  });
}

export function useConvertDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: convertDraftToEntity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake-drafts'] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
