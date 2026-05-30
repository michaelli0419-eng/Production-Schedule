import { useMemo, useState } from 'react';

export function useConversionWizard(opportunity) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState(() => ({
    name: opportunity?.name || '',
    client: opportunity?.delivery_city ? `${opportunity.delivery_city}${opportunity.delivery_state ? `, ${opportunity.delivery_state}` : ''}` : '',
    line_id: 'L1',
    start_date: opportunity?.expected_start_date || '',
    end_date: opportunity?.expected_occupancy_date || '',
    due_date: opportunity?.expected_occupancy_date || '',
    priority: 'Medium',
    modules: opportunity?.module_count || 12,
    crew: 10,
    notes: opportunity?.notes || '',
    routing_template_id: '',
  }));

  function patch(next) {
    setState((prev) => ({ ...prev, ...next }));
  }

  function next() { setStep((s) => Math.min(5, s + 1)); }
  function prev() { setStep((s) => Math.max(1, s - 1)); }

  const canSubmit = useMemo(() => !!state.name && !!state.line_id && !!state.start_date && !!state.end_date, [state]);

  return { step, state, patch, next, prev, setStep, canSubmit };
}
