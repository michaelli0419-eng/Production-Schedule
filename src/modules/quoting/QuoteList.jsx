import { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import Select from '../../components/ui/Select.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useQuotes, useQuote } from './hooks/useQuote.js';
import { useSaveQuote } from './hooks/useSaveQuote.js';
import { useApprovalQueue } from './hooks/useApprovalQueue.js';
import QuoteBuilder from './builder/QuoteBuilder.jsx';
import QuoteRevisionList from './revisions/QuoteRevisionList.jsx';
import ApprovalPanel from './approvals/ApprovalPanel.jsx';
import ApprovalQueue from './approvals/ApprovalQueue.jsx';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'internal_review', label: 'Internal Review' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

function QuoteGrid() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { quotes, isLoading } = useQuotes({ search, status });

  const columns = useMemo(() => ([
    { key: 'quote_number', label: 'Quote #', render: (v) => v || 'Pending' },
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total', render: (v) => `$${Number(v || 0).toLocaleString()}` },
    { key: 'revision', label: 'Rev' },
    { key: 'opportunity', label: 'Opportunity', render: (_, row) => row.opportunities?.name || '-' },
  ]), []);

  return (
    <div>
      <SectionHeader
        title="Quotes"
        subtitle="Quote builder, revisions, approvals"
        actions={<Button onClick={() => navigate('/quoting/quotes/new')}>New Quote</Button>}
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><SearchInput value={search} onChange={setSearch} placeholder="Search quote # or title" /></div>
        <div style={{ width: 210 }}><Select value={status} onChange={setStatus} options={statusOptions} /></div>
      </div>

      <DataTable columns={columns} data={quotes} loading={isLoading} onRowClick={(row) => navigate(`/quoting/quotes/${row.id}`)} />
    </div>
  );
}

function QuoteWorkspace() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');
  const isNew = id === 'new';

  const { quote, isLoading } = useQuote(isNew ? null : id);
  const { saveQuote } = useSaveQuote();
  const { decide } = useApprovalQueue();
  const [tab, setTab] = useState('builder');

  async function createDraftIfNeeded() {
    if (!isNew) return;
    const created = await saveQuote.mutateAsync({
      payload: {
        opportunity_id: opportunityId,
        title: 'New Quote',
        status: 'draft',
      },
    });
    navigate(`/quoting/quotes/${created.id}`, { replace: true });
  }

  const activeQuote = quote;

  return (
    <div>
      <SectionHeader
        title={isNew ? 'New Quote' : `${activeQuote?.quote_number || ''} ${activeQuote?.title || ''}`}
        subtitle={isNew ? 'Create quote draft' : `Status: ${activeQuote?.status || 'draft'}`}
        back
        actions={isNew ? <Button onClick={createDraftIfNeeded} loading={saveQuote.isPending}>Create Draft</Button> : null}
      />

      {!isNew && isLoading && <div>Loading quote...</div>}
      {isNew ? (
        <div style={{ color: '#6b7280' }}>Click "Create Draft" to start quote builder.</div>
      ) : (
        <>
          <Tabs
            tabs={[
              { id: 'builder', label: 'Builder' },
              { id: 'revisions', label: 'Revisions', badge: activeQuote?.quote_revisions?.length || 0 },
              { id: 'approvals', label: 'Approvals', badge: activeQuote?.quote_approvals?.length || 0 },
            ]}
            activeTab={tab}
            onChange={setTab}
          />

          <div style={{ marginTop: 14 }}>
            {tab === 'builder' && <QuoteBuilder quote={activeQuote} onSaved={() => {}} />}
            {tab === 'revisions' && <QuoteRevisionList revisions={activeQuote?.quote_revisions || []} />}
            {tab === 'approvals' && (
              <ApprovalPanel
                approvals={activeQuote?.quote_approvals || []}
                onDecide={(approvalId, status) => decide.mutate({ id: approvalId, status })}
                busy={decide.isPending}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function QuoteList() {
  return (
    <Routes>
      <Route index element={<Navigate to="quotes" replace />} />
      <Route path="quotes" element={<QuoteGrid />} />
      <Route path="quotes/new" element={<QuoteWorkspace />} />
      <Route path="quotes/:id" element={<QuoteWorkspace />} />
      <Route path="approvals" element={<ApprovalQueue />} />
    </Routes>
  );
}
