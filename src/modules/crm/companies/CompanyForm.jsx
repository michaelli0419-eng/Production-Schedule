import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { useCreateCompany, useUpdateCompany } from '../hooks/useCompanies.js';

const DEFAULT = { name: '', type: '', phone: '', website: '' };

export default function CompanyForm({ company = null, onSuccess, onClose }) {
  const [form, setForm] = useState(company ? {
    name: company.name ?? '',
    type: company.type ?? '',
    phone: company.phone ?? '',
    website: company.website ?? '',
  } : DEFAULT);

  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, is_active: true };
    if (company?.id) {
      await updateMutation.mutateAsync({ id: company.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Company name" required />
      <input value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} placeholder="Type" />
      <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
      <input value={form.website} onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))} placeholder="Website" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : company?.id ? 'Update Company' : 'Create Company'}</Button>
      </div>
    </form>
  );
}
