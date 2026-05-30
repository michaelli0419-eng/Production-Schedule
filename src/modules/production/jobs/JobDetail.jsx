import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import SectionHeader from '../../../components/ui/SectionHeader.jsx';
import Tabs from '../../../components/ui/Tabs.jsx';
import { useJob, useUpdateJob } from '../hooks/useJob.js';
import JobForm from './JobForm.jsx';
import JobMilestones from './JobMilestones.jsx';
import JobReadinessPanel from './JobReadinessPanel.jsx';
import JobRoutingPanel from './JobRoutingPanel.jsx';
import JobMaterialsPanel from './JobMaterialsPanel.jsx';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { job, isLoading, error } = useJob(id);
  const update = useUpdateJob();
  const [tab, setTab] = useState('summary');

  async function saveJob(form) {
    if (form.creation_mode === 'manual' && form.business_context_status === 'unlinked' && !form.hierarchy_exception_reason?.trim()) {
      window.alert('Manual unlinked jobs are allowed, but please add an exception reason.');
      return;
    }
    await update.mutateAsync({ id, data: form });
  }

  if (isLoading) return <div style={{ padding: 24 }}>Loading job...</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>Failed to load job: {error.message}</div>;
  if (!job) return <div style={{ padding: 24 }}>Job not found.</div>;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 12 }}>
      <SectionHeader
        title={`${job.job_number || ''} ${job.name || ''}`}
        subtitle={`${job.client || '-'} - ${job.status || '-'}`}
        back
        actions={<Button variant="secondary" onClick={() => navigate('/production/scheduler')}>Open Scheduler</Button>}
      />
      {job.creation_mode === 'manual' && job.business_context_status !== 'linked' ? (
        <div style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: 10 }}>
          This is a manual exception job. Attach Opportunity/Quote/Sales Order when available.
        </div>
      ) : null}

      <Tabs
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'summary', label: 'Summary' },
          { id: 'milestones', label: 'Milestones' },
          { id: 'routing', label: 'Routing' },
          { id: 'materials', label: 'Materials' },
          { id: 'readiness', label: 'Readiness' },
        ]}
      />

      {tab === 'summary' && <JobForm job={job} onSave={saveJob} saving={update.isPending} />}
      {tab === 'milestones' && <JobMilestones jobId={id} />}
      {tab === 'routing' && <JobRoutingPanel jobId={id} />}
      {tab === 'materials' && <JobMaterialsPanel jobId={id} />}
      {tab === 'readiness' && <JobReadinessPanel job={job} />}
    </div>
  );
}
