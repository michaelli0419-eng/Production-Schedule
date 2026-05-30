import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { useCreateOpportunity, useUpdateOpportunity } from '../hooks/useOpportunities.js';

const DEFAULT = { name: '', stage: 'lead', value: 0, probability: 10 };

export default function OpportunityForm({ opportunity = null, onSuccess, onClose }) {
  const [form, setForm] = useState(opportunity ? {
    name: opportunity.name ?? '',
    stage: opportunity.stage ?? 'lead',
    value: opportunity.value ?? 0,
    probability: opportunity.probability ?? 10,
  } : DEFAULT);

  const createMutation = useCreateOpportunity();
  const updateMutation = useUpdateOpportunity();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, value: Number(form.value), probability: Number(form.probability) };
    if (opportunity?.id) {
      await updateMutation.mutateAsync({ id: opportunity.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Opportunity name" required />
      <select value={form.stage} onChange={(e) => setForm((s) => ({ ...s, stage: e.target.value }))}>
        <option value="lead">Lead</option>
        <option value="qualify">Qualify</option>
        <option value="estimate">Estimate</option>
        <option value="proposal">Proposal</option>
        <option value="negotiation">Negotiation</option>
        <option value="award">Award</option>
      </select>
      <input value={form.value} onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))} placeholder="Value" type="number" min="0" />
      <input value={form.probability} onChange={(e) => setForm((s) => ({ ...s, probability: e.target.value }))} placeholder="Probability" type="number" min="0" max="100" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : opportunity?.id ? 'Update Opportunity' : 'Create Opportunity'}</Button>
      </div>
    </form>
  );
}
