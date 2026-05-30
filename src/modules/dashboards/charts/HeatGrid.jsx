export default function HeatGrid({ rows = [] }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 4 }}>
          {(row.values || []).map((v, i) => (
            <div key={i} title={`${v}%`} style={{ width: 18, height: 18, borderRadius: 3, background: v > 90 ? '#fecaca' : v > 70 ? '#fde68a' : '#bbf7d0' }} />
          ))}
        </div>
      ))}
    </div>
  );
}
