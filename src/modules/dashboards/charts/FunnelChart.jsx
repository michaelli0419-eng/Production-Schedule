export default function FunnelChart({ stages = [] }) {
  const max = Math.max(1, ...stages.map((s) => Number(s.count || 0)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {stages.map((s, i) => {
        const pct = (Number(s.count || 0) / max) * 100;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 70px', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12 }}>{s.stage}</div>
            <div style={{ height: 12, background: '#eef2ff', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#4f46e5' }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>{s.count || 0}</div>
          </div>
        );
      })}
    </div>
  );
}
