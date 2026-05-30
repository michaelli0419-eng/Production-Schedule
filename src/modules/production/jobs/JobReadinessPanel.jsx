import { useMemo } from 'react';

export default function JobReadinessPanel({ job }) {
  const checks = useMemo(() => ([
    ['Drawings', !!job?.readiness_drawings],
    ['Materials', !!job?.readiness_materials],
    ['Permits', !!job?.readiness_permits],
    ['Inspections', !!job?.readiness_inspections],
  ]), [job]);

  const score = checks.filter(([, ok]) => ok).length * 25;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Readiness</h4>
      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{score}%</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {checks.map(([label, ok]) => (
          <div key={label} style={{ color: ok ? '#065f46' : '#991b1b', fontSize: 13 }}>{ok ? 'OK' : 'Missing'} - {label}</div>
        ))}
      </div>
    </div>
  );
}
