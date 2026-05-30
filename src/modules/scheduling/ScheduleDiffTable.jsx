export default function ScheduleDiffTable({ rows = [] }) {
  if (!rows.length) return <div style={{ color: '#6b7280' }}>No schedule diff yet.</div>;

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Job</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Step</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Planned Start</th>
            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Planned End</th>
            <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{r.job_id}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>#{r.step_number}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{new Date(r.planned_start).toLocaleString()}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{new Date(r.planned_end).toLocaleString()}</td>
              <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>{Number(r.planned_hours || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
