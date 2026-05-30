import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { useCreateContact, useUpdateContact } from '../hooks/useContacts.js';

const DEFAULT = { first_name: '', last_name: '', email: '', phone: '' };

export default function ContactForm({ contact = null, onSuccess, onClose }) {
  const [form, setForm] = useState(contact ? {
    first_name: contact.first_name ?? '',
    last_name: contact.last_name ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
  } : DEFAULT);

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e) {
    e.preventDefault();
    if (contact?.id) {
      await updateMutation.mutateAsync({ id: contact.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} placeholder="First name" />
      <input value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} placeholder="Last name" required />
      <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="Email" type="email" />
      <input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="Phone" />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : contact?.id ? 'Update Contact' : 'Create Contact'}</Button>
      </div>
    </form>
  );
}
