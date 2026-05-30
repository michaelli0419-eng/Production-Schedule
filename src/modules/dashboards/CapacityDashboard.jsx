import HeatGrid from './charts/HeatGrid.jsx';
import MetricCard from '../../components/ui/MetricCard.jsx';
import { useCapacityMetrics } from './hooks/useCapacityMetrics.js';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export default function CapacityDashboard() {
  const { data, isLoading, error } = useCapacityMetrics();

  if (isLoading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading capacity dashboard…</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>Failed to load capacity dashboard.</div>;
  if (!data) return null;

  const rules = data.rules || [];
  const departments = data.departments || [];
  const steps = data.steps || [];

  const latestRuleByDept = new Map();
  for (const r of rules) if (!latestRuleByDept.has(r.department_id)) latestRuleByDept.set(r.department_id, r);

  const now = new Date();
  const weeks = Array.from({ length: 13 }).map((_, i) => addWeeks(startOfWeek(now), i));

  const rows = departments.map((d) => {
    const rule = latestRuleByDept.get(d.id);
    const cap = Number(rule?.shifts_per_day || 1) * Number(rule?.hours_per_shift || 8) * Number(rule?.days_per_week || 5) * Number(rule?.crew_size || 1);
    const values = weeks.map((w) => {
      const we = addWeeks(w, 1);
      const demand = steps
        .filter((s) => s.department_id === d.id)
        .filter((s) => new Date(s.planned_start) < we && new Date(s.planned_end || s.planned_start) >= w)
        .reduce((sum, s) => sum + Number(s.planned_hours || 0), 0);
      return cap > 0 ? Math.round((demand / cap) * 100) : 0;
    });
    return { label: d.code, values };
  });

  const maxUtil = Math.max(0, ...rows.flatMap((r) => r.values));

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <MetricCard label="Departments" value={String(rows.length)} />
        <MetricCard label="Planned Steps" value={String(steps.length)} />
        <MetricCard label="Max Utilization" value={`${maxUtil}%`} />
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>13-Week Utilization Heat Grid</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12 }}>{r.label}</div>
              <HeatGrid rows={[r]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
