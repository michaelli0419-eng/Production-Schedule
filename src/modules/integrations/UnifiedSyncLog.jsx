import { useSyncLog } from './hooks/useSyncLog.js';

export default function UnifiedSyncLog() {
  const { netsuite, procore, isLoading, error } = useSyncLog();
  if (isLoading) return <div>Loading sync logs...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>Sync log load failed: {error.message}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>NetSuite Log</div>
        {netsuite.slice(0, 20).map((r) => <div key={r.id} style={{ fontSize: 12, borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>[{r.status || 'unknown'}] {r.entity_type || '-'} {r.operation || '-'}</div>)}
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Procore Log</div>
        {procore.slice(0, 20).map((r) => <div key={r.id} style={{ fontSize: 12, borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>[{r.status || 'unknown'}] {r.job_id || '-'} {r.operation || '-'}</div>)}
      </div>
    </div>
  );
}
