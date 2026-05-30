import TaskCard from './TaskCard.jsx';

export default function TaskBoard({ rows = [] }) {
  if (!rows.length) return <div style={{ color: '#6b7280' }}>No scheduled tasks yet.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.slice(0, 30).map((r) => <TaskCard key={r.id} row={r} />)}
    </div>
  );
}
