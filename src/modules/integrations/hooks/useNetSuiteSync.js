import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApprovedQuotes, fetchConfirmedPOs, fetchNetSuiteSyncLog, invokeNetSuiteSync } from '../../../lib/integrationsApi.js';

export function useNetSuiteSync() {
  const qc = useQueryClient();

  const approvedQuotes = useQuery({ queryKey: ['ns-approved-quotes'], queryFn: fetchApprovedQuotes, staleTime: 30000 });
  const confirmedPOs = useQuery({ queryKey: ['ns-confirmed-pos'], queryFn: fetchConfirmedPOs, staleTime: 30000 });
  const syncLog = useQuery({ queryKey: ['ns-sync-log'], queryFn: () => fetchNetSuiteSyncLog(200), staleTime: 15000 });

  const runSync = useMutation({
    mutationFn: ({ action, payload }) => invokeNetSuiteSync(action, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ns-sync-log'] });
      qc.invalidateQueries({ queryKey: ['ns-approved-quotes'] });
      qc.invalidateQueries({ queryKey: ['ns-confirmed-pos'] });
    },
  });

  return {
    approvedQuotes: approvedQuotes.data ?? [],
    confirmedPOs: confirmedPOs.data ?? [],
    syncLog: syncLog.data ?? [],
    isLoading: approvedQuotes.isLoading || confirmedPOs.isLoading || syncLog.isLoading,
    error: approvedQuotes.error || confirmedPOs.error || syncLog.error,
    runSync,
  };
}
