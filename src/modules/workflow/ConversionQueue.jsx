import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import HandoffChecklist from './HandoffChecklist.jsx';
import ConversionWizard from './wizard/ConversionWizard.jsx';
import { useConversionQueue } from './hooks/useConversionQueue.js';

export default function ConversionQueue() {
  const navigate = useNavigate();
  const { queue, isLoading } = useConversionQueue();
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(() => queue.find((o) => o.id === selectedId) || queue[0], [queue, selectedId]);

  const columns = [
    { key: 'opportunity_number', label: 'Opp #' },
    { key: 'name', label: 'Opportunity' },
    { key: 'stage', label: 'Stage' },
    { key: 'contract_value', label: 'Value', render: (v) => `$${Number(v || 0).toLocaleString()}` },
    { key: 'expected_start_date', label: 'Expected Start' },
    { key: 'expected_occupancy_date', label: 'Expected Occupancy' },
  ];

  return (
    <div style={{ padding: 20, display: 'grid', gap: 14 }}>
      <SectionHeader
        title="Opportunity -> Production Conversion"
        subtitle="Convert awarded opportunities into production jobs without re-entry"
        actions={<Button variant="secondary" onClick={() => navigate('/crm/opportunities')}>Back to Opportunities</Button>}
      />

      <DataTable columns={columns} data={queue} loading={isLoading} onRowClick={(row) => setSelectedId(row.id)} emptyText="No awarded/handoff opportunities awaiting conversion." />

      {selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
          <HandoffChecklist opportunity={selected} />
          <ConversionWizard opportunity={selected} />
        </div>
      )}
    </div>
  );
}
