export default function QuoteRevisionList({ revisions = [] }) {
  if (!revisions.length) return <div style={{ color: '#6b7280' }}>No revisions yet.</div>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {revisions.sort((a, b) => b.revision_number - a.revision_number).map((rev) => (
        <div key={rev.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>Revision {rev.revision_number}</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>{rev.change_summary || 'No summary'}</div>
        </div>
      ))}
    </div>
  );
}
