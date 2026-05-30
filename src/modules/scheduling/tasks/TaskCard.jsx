export default function TaskCard({ row }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
      <div style={{ fontWeight: 700 }}>{row.job_id} · Step #{row.step_number}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(row.planned_start).toLocaleString()} - {new Date(row.planned_end).toLocaleString()}</div>
    </div>
  );
}
