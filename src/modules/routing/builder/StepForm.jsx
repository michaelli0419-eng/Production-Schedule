import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';

export default function StepForm({ departments, step, defaultStepNumber, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    step_number: defaultStepNumber,
    name: '',
    department_id: '',
    duration_type: 'per_module',
    duration_hours: 8,
    crew_required: 1,
  });

  useEffect(() => {
    if (step) {
      setForm({
        step_number: step.step_number,
        name: step.name || '',
        department_id: step.department_id || '',
        duration_type: step.duration_type || 'per_module',
        duration_hours: step.duration_hours || 8,
        crew_required: step.crew_required || 1,
      });
    }
  }, [step]);

  function patch(key, value) { setForm((s) => ({ ...s, [key]: value })); }

  function submit(e) {
    e.preventDefault();
    onSave(form, step?.id);
  }

  return (
    <form onSubmit={submit} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{step ? 'Edit Step' : 'New Step'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8 }}>
        <input type="number" min="1" value={form.step_number} onChange={(e) => patch('step_number', Number(e.target.value || 1))} />
        <input value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="Step name" required />
      </div>
      <select value={form.department_id} onChange={(e) => patch('department_id', e.target.value)} required>
        <option value="">Select department</option>
        {departments.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <select value={form.duration_type} onChange={(e) => patch('duration_type', e.target.value)}>
          <option value="fixed">fixed</option>
          <option value="per_module">per_module</option>
          <option value="per_crew_day">per_crew_day</option>
        </select>
        <input type="number" min="0" step="0.25" value={form.duration_hours} onChange={(e) => patch('duration_hours', Number(e.target.value || 0))} />
        <input type="number" min="1" value={form.crew_required} onChange={(e) => patch('crew_required', Number(e.target.value || 1))} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={saving}>Save Step</Button>
      </div>
    </form>
  );
}
