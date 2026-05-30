import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Select from '../../../components/ui/Select.jsx';
import { useCreateActivity } from '../hooks/useCrmActivities.js';

const typeOptions = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
];

export default function ActivityForm({ entityType, entityId, onSuccess, onClose }) {
  const [type, setType] = useState('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const createMutation = useCreateActivity();

  async function handleSubmit(e) {
    e.preventDefault();
    await createMutation.mutateAsync({ entity_type: entityType, entity_id: entityId, type, subject, body: body || null });
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <FormField label="Type"><Select value={type} onChange={setType} options={typeOptions} /></FormField>
      <FormField label="Subject" required><input value={subject} onChange={(e) => setSubject(e.target.value)} required /></FormField>
      <FormField label="Notes"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} /></FormField>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Log Activity'}</Button>
      </div>
    </form>
  );
}
