import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNetSuiteSyncLog, fetchProcoreSyncLog, fetchWebhookEvents, retryWebhookEvent } from '../../../lib/integrationsApi.js';

export function useSyncLog() {
  const ns = useQuery({ queryKey: ['sync-log-ns'], queryFn: () => fetchNetSuiteSyncLog(200), staleTime: 15000 });
  const pc = useQuery({ queryKey: ['sync-log-pc'], queryFn: () => fetchProcoreSyncLog(200), staleTime: 15000 });

  return {
    netsuite: ns.data ?? [],
    procore: pc.data ?? [],
    isLoading: ns.isLoading || pc.isLoading,
    error: ns.error || pc.error,
  };
}

export function useWebhookEvents() {
  const qc = useQueryClient();
  const events = useQuery({ queryKey: ['webhook-events'], queryFn: () => fetchWebhookEvents(200), staleTime: 10000 });
  const retry = useMutation({
    mutationFn: retryWebhookEvent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-events'] }),
  });

  return {
    events: events.data ?? [],
    isLoading: events.isLoading,
    error: events.error,
    retry,
  };
}
