import MetricCard from '../../components/ui/MetricCard.jsx';
import BarChart from './charts/BarChart.jsx';
import { useProductionMetrics } from './hooks/useProductionMetrics.js';

export default function ProductionDashboard() {
  const { data, isLoading, error } = useProductionMetrics();

  if (isLoading) return <div>Loading production dashboard...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>Failed to load production dashboard.</div>;

  const statusData = Object.entries(data.byStatus || {}).map(([label, value]) => ({ label, value }));
  const lineData = Object.entries(data.byLine || {}).map(([label, value]) => ({ label, value }));
  const readinessAvg = data.readiness?.length ? Math.round(data.readiness.reduce((s, r) => s + r.score, 0) / data.readiness.length) : 0;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard label="Jobs" value={String(data.jobs.length)} />
        <MetricCard label="Avg Readiness" value={`${readinessAvg}%`} />
        <MetricCard label="Risk Jobs" value={String(data.risks.length)} />
        <MetricCard label="Milestones" value={String(data.milestones.length)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Jobs by Status</div>
          <BarChart data={statusData} xKey="label" yKey="value" color="#2563eb" />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Jobs by Line</div>
          <BarChart data={lineData} xKey="label" yKey="value" color="#7c3aed" />
        </div>
      </div>
    </div>
  );
}
