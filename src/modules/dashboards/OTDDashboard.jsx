import MetricCard from '../../components/ui/MetricCard.jsx';
import { useOTDMetrics } from './hooks/useOTDMetrics.js';

export default function OTDDashboard() {
  const { data, isLoading, error } = useOTDMetrics();

  if (isLoading) return <div>Loading OTD dashboard...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>Failed to load OTD dashboard.</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard label="OTD" value={`${data.otdPct}%`} />
        <MetricCard label="Completed" value={String(data.totalCompleted)} />
        <MetricCard label="On Time" value={String(data.onTime)} />
        <MetricCard label="Late" value={String(data.late)} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Late Jobs</div>
        {data.lateJobs.length === 0 && <div style={{ color: '#6b7280' }}>No late completed jobs.</div>}
        {data.lateJobs.map((j) => (
          <div key={j.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, borderBottom: '1px solid #f3f4f6', padding: '6px 0' }}>
            <div>{j.name}</div>
            <div style={{ color: '#6b7280' }}>Due {j.due_date || '-'}</div>
            <div style={{ color: '#991b1b' }}>Actual {j.end_date || '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
