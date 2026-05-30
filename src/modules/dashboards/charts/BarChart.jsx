export default function BarChart({ data = [], xKey = 'label', yKey = 'value', color = '#2563eb' }) {
  const max = Math.max(1, ...data.map((d) => Number(d[yKey] || 0)));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {data.map((d, i) => {
        const val = Number(d[yKey] || 0);
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12 }}>{d[xKey]}</div>
            <div style={{ height: 10, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>{val.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}
