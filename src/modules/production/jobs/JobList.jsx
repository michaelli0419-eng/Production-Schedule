import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';
import DataTable from '../../../components/ui/DataTable.jsx';
import SearchInput from '../../../components/ui/SearchInput.jsx';
import SectionHeader from '../../../components/ui/SectionHeader.jsx';
import Select from '../../../components/ui/Select.jsx';
import { useProductionJobs } from '../hooks/useJob.js';
import JobDetail from './JobDetail.jsx';

function JobGrid() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [line, setLine] = useState('');
  const [status, setStatus] = useState('');

  const { jobs, isLoading } = useProductionJobs({ search, line, status });

  const columns = useMemo(() => ([
    { key: 'job_number', label: 'Job #' },
    { key: 'name', label: 'Project' },
    { key: 'client', label: 'Client' },
    { key: 'line_id', label: 'Line' },
    { key: 'status', label: 'Status' },
    { key: 'creation_mode', label: 'Mode' },
    { key: 'business_context_status', label: 'Context' },
    { key: 'start_date', label: 'Topset' },
    { key: 'end_date', label: 'Shipping' },
    { key: 'due_date', label: 'Set' },
  ]), []);

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader
        title="Production Jobs"
        subtitle="Full-page job operations view"
        actions={<Button variant="secondary" onClick={() => navigate('/production/scheduler')}>Open Scheduler</Button>}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><SearchInput value={search} onChange={setSearch} placeholder="Search job #, project, client" /></div>
        <div style={{ width: 170 }}>
          <Select
            value={line}
            onChange={setLine}
            options={[
              { value: '', label: 'All Lines' },
              { value: 'L1', label: 'Line 1' },
              { value: 'L2', label: 'Line 2' },
              { value: 'L3', label: 'Line 3' },
              { value: 'L4', label: 'Line 4' },
              { value: 'QUEUE', label: 'Queue' },
            ]}
          />
        </div>
        <div style={{ width: 170 }}>
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { value: '', label: 'All Status' },
              { value: 'forecast', label: 'forecast' },
              { value: 'approved', label: 'approved' },
              { value: 'hold', label: 'hold' },
              { value: 'production', label: 'production' },
              { value: 'delayed', label: 'delayed' },
              { value: 'complete', label: 'complete' },
            ]}
          />
        </div>
      </div>

      <DataTable columns={columns} data={jobs} loading={isLoading} onRowClick={(row) => navigate(`/production/jobs/${row.id}`)} emptyText="No jobs found." />
    </div>
  );
}

export default function JobList() {
  return (
    <Routes>
      <Route index element={<JobGrid />} />
      <Route path=":id" element={<JobDetail />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
