import MetricCard from '../../components/ui/MetricCard.jsx';
import BarChart from './charts/BarChart.jsx';
import FunnelChart from './charts/FunnelChart.jsx';
import { useSalesMetrics } from './hooks/useSalesMetrics.js';

export default function SalesDashboard() {
  const { data, isLoading, error } = useSalesMetrics();

  if (isLoading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading sales dashboard…</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>Failed to load sales dashboard.</div>;
  if (!data) return null;

  const stageData = (data.byStage || []).map((s) => ({ stage: s.stage, count: s.count, value: Math.round(s.weighted) }));
  const repData = (data.byRep || []).map((r) => ({ label: r.rep, value: Math.round(r.weighted) })).slice(0, 8);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricCard label="Pipeline" value={`$${Math.round(data.totalValue).toLocaleString()}`} />
        <MetricCard label="Weighted" value={`$${Math.round(data.weightedValue).toLocaleString()}`} />
        <MetricCard label="Win Rate" value={`${data.winRate}%`} />
        <MetricCard label="Active Stages" value={String((data.byStage || []).length)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Pipeline Funnel</div>
          <FunnelChart stages={stageData} />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Weighted Forecast by Rep</div>
          <BarChart data={repData} xKey="label" yKey="value" color="#059669" />
        </div>
      </div>
    </div>
  );
}
