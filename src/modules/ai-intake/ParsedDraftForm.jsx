import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button.jsx';

export default function ParsedDraftForm({ draft, onSave, onConvert, saving, converting }) {
  const parsed = useMemo(() => draft?.parsed_json || {}, [draft]);
  const [form, setForm] = useState(() => ({
    name: parsed.name || parsed.opportunity_name || '',
    title: parsed.title || '',
    company_name: parsed.company_name || '',
    contract_value: parsed.contract_value || 0,
    probability: parsed.probability || 35,
    expected_start_date: parsed.expected_start_date || '',
    expected_occupancy_date: parsed.expected_occupancy_date || '',
    stage: parsed.stage || 'lead',
    notes: parsed.notes || '',
    confidence: draft?.confidence || 0,
  }));

  function patch(key, value) { setForm((s) => ({ ...s, [key]: value })); }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Parsed Fields</div>
      <input value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="Opportunity name" />
      <input value={form.company_name} onChange={(e) => patch('company_name', e.target.value)} placeholder="Company" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input type="number" value={form.contract_value} onChange={(e) => patch('contract_value', Number(e.target.value || 0))} placeholder="Value" />
        <input type="number" value={form.probability} onChange={(e) => patch('probability', Number(e.target.value || 0))} placeholder="Probability" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input type="date" value={form.expected_start_date} onChange={(e) => patch('expected_start_date', e.target.value)} />
        <input type="date" value={form.expected_occupancy_date} onChange={(e) => patch('expected_occupancy_date', e.target.value)} />
      </div>
      <textarea rows={4} value={form.notes} onChange={(e) => patch('notes', e.target.value)} placeholder="Notes" />

      <div style={{ background: form.confidence < 0.7 ? '#fef3c7' : '#ecfeff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 12 }}>
        Confidence: {Math.round(Number(form.confidence || 0) * 100)}% {Number(form.confidence || 0) < 0.7 ? '(warning only)' : ''}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Button variant="secondary" onClick={() => onSave(form)} loading={saving}>Save Review</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => onConvert('lead', form)} loading={converting}>Convert to Lead</Button>
          <Button onClick={() => onConvert('opportunity', form)} loading={converting}>Convert to Opportunity</Button>
        </div>
      </div>
    </div>
  );
}
