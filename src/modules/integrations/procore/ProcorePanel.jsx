import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import SearchInput from '../../../components/ui/SearchInput.jsx';
import { useProcoreSync } from '../hooks/useProcoreSync.js';

export default function ProcorePanel() {
  const [search, setSearch] = useState('');
  const { jobs, syncLog, isLoading, error, runSync } = useProcoreSync(search);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Procore</h3>
        <Button variant="secondary" onClick={() => runSync.mutate({})} loading={runSync.isPending}>Run Generic Sync</Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search job number / project" />

      {error && <div style={{ color: '#b91c1c' }}>Procore sync error: {error.message}</div>}
      {isLoading && <div>Loading Procore data...</div>}

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Jobs</div>
        {jobs.length === 0 && <div style={{ color: '#6b7280' }}>No jobs found.</div>}
        {jobs.map((j) => (
          <div key={j.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderBottom: '1px solid #f3f4f6', padding: '6px 0' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{j.job_number || j.id}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{j.name} {j.procore_project_id ? `· Procore ${j.procore_project_id}` : ''}</div>
            </div>
            <Button size="sm" onClick={() => runSync.mutate({ job_number: j.job_number, procore_project_id: j.procore_project_id || undefined })} loading={runSync.isPending}>Sync</Button>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent Procore Sync Log</div>
        {syncLog.slice(0, 10).map((row) => (
          <div key={row.id} style={{ fontSize: 12, borderBottom: '1px solid #f3f4f6', padding: '4px 0' }}>
            [{row.status || 'unknown'}] {row.job_id || '-'} {row.operation || '-'}
          </div>
        ))}
      </div>
    </div>
  );
}
