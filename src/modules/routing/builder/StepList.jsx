import Button from '../../../components/ui/Button.jsx';

export default function StepList({ steps = [], onEdit, onDelete }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {steps.length === 0 && <div style={{ color: '#6b7280' }}>No routing steps yet.</div>}
      {steps.map((step) => (
        <div key={step.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700 }}>#{step.step_number} {step.name}</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>{step.departments?.code || '-'} - {Number(step.duration_hours || 0)}h ({step.duration_type})</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="secondary" onClick={() => onEdit(step)}>Edit</Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(step.id)}>Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
