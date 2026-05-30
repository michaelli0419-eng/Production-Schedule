import ConflictCard from './ConflictCard.jsx';

export default function ConflictList({ conflicts = [] }) {
  if (!conflicts.length) return <div style={{ color: '#6b7280' }}>No conflicts detected.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {conflicts.map((c, i) => <ConflictCard key={`${c.step_a_id}-${c.step_b_id}-${i}`} conflict={c} />)}
    </div>
  );
}
