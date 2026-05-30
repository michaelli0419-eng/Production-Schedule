import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';

export default function JobForm({ job, onSave, onCancel, saving }) {
  const [form, setForm] = useState(job || {});

  useEffect(() => setForm(job || {}), [job]);

  function patch(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function submit(e) {
    e.preventDefault();
    onSave?.(form);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      <input value={form.name || ''} onChange={(e) => patch('name', e.target.value)} placeholder="Project name" required />
      <input value={form.client || ''} onChange={(e) => patch('client', e.target.value)} placeholder="Client" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <input type="date" value={form.start_date || ''} onChange={(e) => patch('start_date', e.target.value)} />
        <input type="date" value={form.end_date || ''} onChange={(e) => patch('end_date', e.target.value)} />
        <input type="date" value={form.due_date || ''} onChange={(e) => patch('due_date', e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <select value={form.line_id || 'L1'} onChange={(e) => patch('line_id', e.target.value)}>
          <option value="L1">Production Line 1</option>
          <option value="L2">Production Line 2</option>
          <option value="L3">Production Line 3</option>
          <option value="L4">Production Line 4</option>
          <option value="QUEUE">Queue</option>
        </select>
        <select value={form.status || 'approved'} onChange={(e) => patch('status', e.target.value)}>
          <option value="forecast">forecast</option>
          <option value="approved">approved</option>
          <option value="hold">hold</option>
          <option value="production">production</option>
          <option value="delayed">delayed</option>
          <option value="complete">complete</option>
        </select>
        <select value={form.priority || 'Medium'} onChange={(e) => patch('priority', e.target.value)}>
          <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <select value={form.creation_mode || 'manual'} onChange={(e) => patch('creation_mode', e.target.value)}>
          <option value="workflow">workflow</option>
          <option value="manual">manual</option>
          <option value="import">import</option>
        </select>
        <select value={form.business_context_status || 'unlinked'} onChange={(e) => patch('business_context_status', e.target.value)}>
          <option value="linked">linked</option>
          <option value="partial">partial</option>
          <option value="unlinked">unlinked</option>
        </select>
      </div>
      <input value={form.sales_order_id || ''} onChange={(e) => patch('sales_order_id', e.target.value || null)} placeholder="Sales Order ID (optional for manual)" />
      <input value={form.opportunity_id || ''} onChange={(e) => patch('opportunity_id', e.target.value || null)} placeholder="Opportunity ID (optional)" />
      <input value={form.quote_id || ''} onChange={(e) => patch('quote_id', e.target.value || null)} placeholder="Quote ID (optional)" />
      <textarea
        rows={2}
        value={form.hierarchy_exception_reason || ''}
        onChange={(e) => patch('hierarchy_exception_reason', e.target.value)}
        placeholder="Exception reason (required for manual jobs that are unlinked)"
      />
      <textarea rows={4} value={form.notes || ''} onChange={(e) => patch('notes', e.target.value)} placeholder="Notes" />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Job</Button>
      </div>
    </form>
  );
}
