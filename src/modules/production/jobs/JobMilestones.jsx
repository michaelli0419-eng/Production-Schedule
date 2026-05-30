import Button from '../../../components/ui/Button.jsx';
import { useJobMilestones, useSaveMilestone } from '../hooks/useJobMilestones.js';

export default function JobMilestones({ jobId }) {
  const { milestones, isLoading } = useJobMilestones(jobId);
  const saveMilestone = useSaveMilestone(jobId);

  async function addMilestone() {
    await saveMilestone.mutateAsync({
      job_id: jobId,
      name: 'New Milestone',
      milestone_type: 'other',
      status: 'pending',
    });
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Milestones</h4>
        <Button size="sm" variant="secondary" onClick={addMilestone} loading={saveMilestone.isPending}>Add Milestone</Button>
      </div>
      {isLoading && <div>Loading milestones...</div>}
      {!isLoading && milestones.length === 0 && <div style={{ color: '#6b7280' }}>No milestones yet.</div>}
      {milestones.map((m) => (
        <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{m.name}</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>{m.milestone_type}</div>
          </div>
          <div>{m.planned_date || '-'}</div>
          <div>{m.status}</div>
        </div>
      ))}
    </div>
  );
}
