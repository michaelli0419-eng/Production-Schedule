import { useApprovalQueue } from '../hooks/useApprovalQueue.js';

export default function ApprovalQueue() {
  const { queue, isLoading } = useApprovalQueue();

  if (isLoading) return <div>Loading approval queue...</div>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {queue.length === 0 && <div style={{ color: '#6b7280' }}>No pending approvals.</div>}
      {queue.map((row) => (
        <div key={row.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>{row.quotes?.quote_number} - {row.quotes?.title}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Required Role: {row.role_required}</div>
        </div>
      ))}
    </div>
  );
}
