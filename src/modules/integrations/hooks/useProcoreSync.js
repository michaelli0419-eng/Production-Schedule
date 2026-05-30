import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJobsForIntegration, fetchProcoreSyncLog, invokeProcoreSync } from '../../../lib/integrationsApi.js';

export function useProcoreSync(search = '') {
  const qc = useQueryClient();

  const jobs = useQuery({ queryKey: ['procore-jobs', search], queryFn: () => fetchJobsForIntegration(search), staleTime: 30000 });
  const syncLog = useQuery({ queryKey: ['procore-sync-log'], queryFn: () => fetchProcoreSyncLog(200), staleTime: 15000 });

  const runSync = useMutation({
    mutationFn: (payload) => invokeProcoreSync(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procore-sync-log'] });
      qc.invalidateQueries({ queryKey: ['procore-jobs'] });
    },
  });

  return {
    jobs: jobs.data ?? [],
    syncLog: syncLog.data ?? [],
    isLoading: jobs.isLoading || syncLog.isLoading,
    error: jobs.error || syncLog.error,
    runSync,
  };
}
