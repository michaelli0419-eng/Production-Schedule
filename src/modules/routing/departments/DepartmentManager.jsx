export default function DepartmentManager({ departments = [] }) {
  const grouped = departments.reduce((acc, d) => {
    const key = d.production_line_id || 'UNASSIGNED';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {Object.entries(grouped).map(([line, items]) => (
        <div key={line} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{line}</div>
          {items.map((d) => (
            <div key={d.id} style={{ fontSize: 13, color: '#374151', padding: '2px 0' }}>{d.code} - {d.name}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
