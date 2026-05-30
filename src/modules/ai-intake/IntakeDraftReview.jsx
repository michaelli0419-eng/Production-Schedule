import ParsedDraftForm from './ParsedDraftForm.jsx';

export default function IntakeDraftReview({ draft, onSave, onConvert, saving, converting }) {
  if (!draft) return <div style={{ color: '#6b7280' }}>Select a draft to review.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, overflow: 'auto', maxHeight: 420 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Raw Intake Text</div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
          {draft.raw_text || ''}
        </pre>
      </div>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
        <ParsedDraftForm
          draft={draft}
          onSave={onSave}
          onConvert={onConvert}
          saving={saving}
          converting={converting}
        />
      </div>
    </div>
  );
}
