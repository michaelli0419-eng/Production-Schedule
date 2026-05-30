import { useJobRoutingSteps } from '../hooks/useJobRoutingSteps.js';

export default function JobRoutingPanel({ jobId }) {
  const { routingSteps, isLoading } = useJobRoutingSteps(jobId);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h4 style={{ margin: 0 }}>Routing Steps</h4>
      {isLoading && <div>Loading routing steps...</div>}
      {!isLoading && routingSteps.length === 0 && <div style={{ color: '#6b7280' }}>No routing steps assigned yet.</div>}
      {routingSteps.map((step) => (
        <div key={step.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 700 }}>{step.step_name || `Step ${step.sequence_no}`}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Status: {step.status || 'pending'}</div>
          <div style={{ fontSize: 13 }}>Planned: {step.planned_start || '-'} {'->'} {step.planned_end || '-'}</div>
        </div>
      ))}
    </div>
  );
}
