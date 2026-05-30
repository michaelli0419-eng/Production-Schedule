export default function StepDurationCalc({ steps = [] }) {
  const totalHours = steps.reduce((sum, s) => sum + Number(s.duration_hours || 0), 0);
  const moduleHours = steps
    .filter((s) => s.duration_type === 'per_module')
    .reduce((sum, s) => sum + Number(s.duration_hours || 0), 0);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'flex', gap: 18 }}>
      <div><strong>{totalHours.toFixed(1)}h</strong> Total Template Hours</div>
      <div><strong>{moduleHours.toFixed(1)}h</strong> Per-Module Hours</div>
    </div>
  );
}
