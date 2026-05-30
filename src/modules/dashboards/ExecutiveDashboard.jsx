import MetricCard from '../../components/ui/MetricCard.jsx';
import BarChart from './charts/BarChart.jsx';
import SparkLine from './charts/SparkLine.jsx';
import { useExecutiveMetrics } from './hooks/useExecutiveMetrics.js';

export default function ExecutiveDashboard({ range }) {
  const { data, isLoading, error } = useExecutiveMetrics(range);

  if (isLoading) return <div>Loading executive dashboard...</div>;
  if (error) return <div style={{ color: '#b91c1c' }}>Failed to load executive dashboard.</div>;

  const series = (data.jobs || []).slice(0, 12).map((j) => Number(j.progress || 0));
  const byStatus = Object.entries((data.jobs || []).reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {}))
    .map(([label, value]) => ({ label, value }));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        <MetricCard label="Pipeline" value={`$${Math.round(data.pipelineValue || 0).toLocaleString()}`} />
        <MetricCard label="Weighted" value={`$${Math.round(data.weightedPipeline || 0).toLocaleString()}`} />
        <MetricCard label="WIP" value={String(data.wip || 0)} />
        <MetricCard label="Backlog" value={String(data.backlog || 0)} />
        <MetricCard label="OTD" value={`${data.otd || 0}%`} />
        <MetricCard label="Manual Exceptions" value={String(data.manualExceptions || 0)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Jobs by Status</div>
          <BarChart data={byStatus} xKey="label" yKey="value" />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Recent Progress Trend</div>
          <SparkLine values={series.length ? series : [0, 0, 0, 0]} />
        </div>
      </div>
    </div>
  );
}
