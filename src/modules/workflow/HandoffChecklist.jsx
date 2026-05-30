export default function HandoffChecklist({ opportunity }) {
  const checks = [
    ['Stage ready', ['award', 'handoff'].includes(opportunity?.stage)],
    ['Contract value set', Number(opportunity?.contract_value || 0) > 0],
    ['Expected start set', !!opportunity?.expected_start_date],
    ['Expected occupancy set', !!opportunity?.expected_occupancy_date],
  ];

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Handoff Checklist</h4>
      <div style={{ display: 'grid', gap: 6 }}>
        {checks.map(([label, ok]) => (
          <div key={label} style={{ color: ok ? '#065f46' : '#991b1b', fontSize: 13 }}>
            {ok ? 'OK' : 'Missing'} - {label}
          </div>
        ))}
      </div>
    </div>
  );
}
