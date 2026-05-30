import { useMemo, useState } from 'react';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import IntakeUpload from './IntakeUpload.jsx';
import IntakeDraftReview from './IntakeDraftReview.jsx';
import { useConvertDraft, useIntakeDrafts, useParseDocument, useUpdateDraft } from './hooks/useIntakeDrafts.js';

export default function IntakeInbox() {
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const { drafts, isLoading, error } = useIntakeDrafts(status);
  const parse = useParseDocument();
  const saveDraft = useUpdateDraft();
  const convert = useConvertDraft();

  const selected = useMemo(() => drafts.find((d) => d.id === selectedId) || drafts[0], [drafts, selectedId]);

  async function handleParse(payload) {
    await parse.mutateAsync(payload);
  }

  async function handleSave(form) {
    if (!selected) return;
    await saveDraft.mutateAsync({
      id: selected.id,
      patch: { parsed_json: form, status: 'reviewed' },
    });
  }

  async function handleConvert(entityType, form) {
    if (!selected) return;

    if (entityType === 'lead') {
      await convert.mutateAsync({
        draftId: selected.id,
        entityType: 'lead',
        payload: {
          title: form.title || form.name || 'AI Intake Lead',
          source: selected.source_type || 'ai_intake',
          estimated_value: Number(form.contract_value || 0),
          description: form.notes || null,
          status: 'new',
        },
      });
    } else {
      await convert.mutateAsync({
        draftId: selected.id,
        entityType: 'opportunity',
        payload: {
          name: form.name || 'AI Intake Opportunity',
          stage: form.stage || 'lead',
          probability: Number(form.probability || 35),
          contract_value: Number(form.contract_value || 0),
          expected_start_date: form.expected_start_date || null,
          expected_occupancy_date: form.expected_occupancy_date || null,
          source_type: selected.source_type || 'ai_intake',
          notes: form.notes || null,
        },
      });
    }
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 12 }}>
      <SectionHeader title="AI Intake" subtitle="Parse inbound text into reviewed lead/opportunity drafts" />

      <IntakeUpload onParse={handleParse} parsing={parse.isPending} />

      <Tabs
        activeTab={status}
        onChange={setStatus}
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'reviewed', label: 'Reviewed' },
          { id: 'converted', label: 'Converted' },
          { id: 'rejected', label: 'Rejected' },
        ]}
      />

      {error && <div style={{ color: '#b91c1c' }}>AI intake load failed: {error.message}</div>}
      {isLoading && <div>Loading intake drafts...</div>}

      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, maxHeight: 520, overflow: 'auto' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Drafts</div>
            {drafts.length === 0 && <div style={{ color: '#6b7280' }}>No drafts.</div>}
            {drafts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  background: selected?.id === d.id ? '#eff6ff' : '#fff',
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700 }}>{d.source_type || 'source'} · {d.status}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{Math.round(Number(d.confidence || 0) * 100)}% confidence</div>
              </button>
            ))}
          </div>

          <IntakeDraftReview
            draft={selected}
            onSave={handleSave}
            onConvert={handleConvert}
            saving={saveDraft.isPending}
            converting={convert.isPending}
          />
        </div>
      )}
    </div>
  );
}
