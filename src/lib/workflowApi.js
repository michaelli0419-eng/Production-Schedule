import { supabase } from './supabase.js';

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchConversionQueue() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, opportunity_number, name, stage, contract_value, module_count, delivery_city, delivery_state, expected_start_date, expected_occupancy_date, bdm_name, estimator_name, pm_name, converted_job_id, notes')
    .in('stage', ['award', 'handoff'])
    .is('converted_job_id', null)
    .order('expected_start_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function convertOpportunityToJob({ opportunityId, jobData }) {
  const { data: opp, error: oppError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', opportunityId)
    .single();
  if (oppError) throw oppError;

  const start = jobData.start_date || opp.expected_start_date || new Date().toISOString().slice(0, 10);
  const end = jobData.end_date || opp.expected_occupancy_date || addDays(start, 45);
  const due = jobData.due_date || end;

  const { data: approvedQuote } = await supabase
    .from('quotes')
    .select('id, total, title, netsuite_so_id')
    .eq('opportunity_id', opportunityId)
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const salesOrderPayload = {
    opportunity_id: opportunityId,
    quote_id: approvedQuote?.id ?? null,
    customer_name: jobData.client || opp.delivery_city || 'Unassigned Customer',
    status: 'released_to_production',
    order_date: new Date().toISOString().slice(0, 10),
    requested_ship_date: end,
    promised_ship_date: due,
    total_amount: Number(approvedQuote?.total || opp.contract_value || 0),
    netsuite_so_id: approvedQuote?.netsuite_so_id ?? null,
    source_system: approvedQuote?.netsuite_so_id ? 'netsuite' : 'internal',
    notes: `Created by opportunity conversion (${opp.opportunity_number || opportunityId}).`,
  };

  const { data: salesOrder, error: soError } = await supabase
    .from('sales_orders')
    .insert(salesOrderPayload)
    .select('id, sales_order_number')
    .single();
  if (soError) throw soError;

  const jobId = crypto.randomUUID();
  const jobNumber = `JOB-${new Date().getFullYear()}-${jobId.slice(0, 6).toUpperCase()}`;

  const jobPayload = {
    id: jobId,
    job_number: jobNumber,
    name: jobData.name || opp.name,
    client: jobData.client || opp.delivery_city || 'Unassigned Client',
    line_id: jobData.line_id || 'L1',
    start_date: start,
    end_date: end,
    due_date: due,
    status: jobData.status || 'approved',
    priority: jobData.priority || 'Medium',
    modules: Number(jobData.modules || opp.module_count || 12),
    crew: Number(jobData.crew || 10),
    notes: jobData.notes || opp.notes || null,
    source_type: 'crm_conversion',
    opportunity_id: opportunityId,
    quote_id: approvedQuote?.id ?? null,
    sales_order_id: salesOrder.id,
    creation_mode: 'workflow',
    business_context_status: 'linked',
    hierarchy_exception_reason: null,
  };

  const { error: jobError } = await supabase.from('jobs').insert(jobPayload);
  if (jobError) throw jobError;

  const { error: oppUpdateError } = await supabase
    .from('opportunities')
    .update({ converted_job_id: jobId, converted_at: new Date().toISOString() })
    .eq('id', opportunityId);
  if (oppUpdateError) throw oppUpdateError;

  const milestones = [
    { name: 'Production Start', milestone_type: 'production_start', planned_date: start, status: 'pending' },
    { name: 'Off Line', milestone_type: 'off_line', planned_date: addDays(start, 30), status: 'pending' },
    { name: 'Shipping', milestone_type: 'shipping', planned_date: end, status: 'pending' },
  ].map((m) => ({ ...m, job_id: jobId }));

  const { error: mError } = await supabase.from('job_milestones').insert(milestones);
  if (mError) throw mError;

  if (jobData.routing_template_id) {
    const { data: templateSteps, error: stepErr } = await supabase
      .from('routing_steps')
      .select('*')
      .eq('template_id', jobData.routing_template_id)
      .eq('is_active', true)
      .order('step_number', { ascending: true });
    if (stepErr) throw stepErr;

    let cursor = new Date(`${start}T08:00:00Z`);
    const jrsPayload = (templateSteps || []).map((s) => {
      const plannedStart = new Date(cursor);
      const durationHours = Number(s.duration_hours || 8);
      const plannedEnd = new Date(plannedStart.getTime() + durationHours * 60 * 60 * 1000);
      cursor = plannedEnd;

      return {
        job_id: jobId,
        template_step_id: s.id,
        department_id: s.department_id,
        step_number: s.step_number,
        name: s.name,
        planned_start: plannedStart.toISOString(),
        planned_end: plannedEnd.toISOString(),
        planned_hours: durationHours,
        crew_assigned: Number(s.crew_required || 0),
        status: 'not_started',
      };
    });

    if (jrsPayload.length > 0) {
      const { error: jrsError } = await supabase.from('job_routing_steps').insert(jrsPayload);
      if (jrsError) throw jrsError;
    }
  }

  return { jobId, jobNumber, salesOrderId: salesOrder.id, salesOrderNumber: salesOrder.sales_order_number };
}
