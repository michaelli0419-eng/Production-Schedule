import Button from '../../../components/ui/Button.jsx';

export default function ApprovalPanel({ approvals = [], onDecide, busy }) {
  if (!approvals.length) return <div style={{ color: '#6b7280' }}>No approval steps yet.</div>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {approvals.map((step) => (
        <div key={step.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>Step {step.step} - {step.role_required}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Status: {step.status}</div>
          {step.status === 'pending' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" onClick={() => onDecide(step.id, 'approved')} loading={busy}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => onDecide(step.id, 'rejected')} loading={busy}>Reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
