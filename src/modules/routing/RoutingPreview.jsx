import { useMemo } from 'react';

export default function RoutingPreview({ template }) {
  const steps = useMemo(() => [...(template?.routing_steps || [])].sort((a, b) => a.step_number - b.step_number), [template]);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Routing Preview</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {steps.length === 0 && <div style={{ color: '#6b7280' }}>No steps configured.</div>}
        {steps.map((s) => (
          <div key={s.id} style={{ fontSize: 13 }}>
            {s.step_number}. {s.name} ({s.departments?.code || '-'}) - {Number(s.duration_hours || 0)}h
          </div>
        ))}
      </div>
    </div>
  );
}
