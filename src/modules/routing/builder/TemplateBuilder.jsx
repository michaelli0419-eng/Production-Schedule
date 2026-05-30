import { useMemo, useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import StepList from './StepList.jsx';
import StepForm from './StepForm.jsx';
import StepDurationCalc from './StepDurationCalc.jsx';
import { useDepartments } from '../hooks/useDepartments.js';
import { useRoutingSteps } from '../hooks/useRoutingSteps.js';

export default function TemplateBuilder({ template }) {
  const { departments } = useDepartments();
  const { createStep, saveStep, removeStep } = useRoutingSteps(template.id);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const steps = useMemo(
    () => [...(template.routing_steps || [])].sort((a, b) => a.step_number - b.step_number),
    [template.routing_steps]
  );

  async function handleSave(form, stepId) {
    const payload = {
      template_id: template.id,
      step_number: form.step_number,
      name: form.name,
      department_id: form.department_id,
      duration_type: form.duration_type,
      duration_hours: form.duration_hours,
      crew_required: form.crew_required,
      is_active: true,
    };

    if (stepId) await saveStep.mutateAsync({ id: stepId, payload });
    else await createStep.mutateAsync(payload);

    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(id) {
    await removeStep.mutateAsync(id);
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Template Steps</h3>
        <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setShowForm(true); }}>Add Step</Button>
      </div>

      {showForm && (
        <StepForm
          departments={departments}
          step={editing}
          defaultStepNumber={steps.length + 1}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          saving={createStep.isPending || saveStep.isPending}
        />
      )}

      <StepDurationCalc steps={steps} />
      <StepList
        steps={steps}
        onEdit={(step) => { setEditing(step); setShowForm(true); }}
        onDelete={handleDelete}
      />
    </div>
  );
}
