import { supabase } from '../../lib/supabase.js';

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

export async function fetchExecutiveMetrics(dateFrom, dateTo) {
  const [jobsRes, oppRes, routingRes] = await Promise.all([
    supabase.from('jobs').select('id, status, start_date, end_date, due_date, priority, progress, line_id, creation_mode, business_context_status, sales_order_id'),
    supabase.from('opportunities').select('id, stage, contract_value, probability, expected_start_date'),
    supabase.from('job_routing_steps').select('id, status, planned_start, planned_end, planned_hours'),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (oppRes.error) throw oppRes.error;
  if (routingRes.error) throw routingRes.error;

  const jobs = jobsRes.data || [];
  const opps = oppRes.data || [];
  const routing = routingRes.data || [];

  const pipelineValue = opps.reduce((s, o) => s + Number(o.contract_value || 0), 0);
  const weightedPipeline = opps.reduce((s, o) => s + Number(o.contract_value || 0) * (Number(o.probability || 0) / 100), 0);
  const wip = jobs.filter((j) => ['approved', 'production', 'hold', 'delayed'].includes(j.status)).length;
  const backlog = jobs.filter((j) => ['forecast', 'approved'].includes(j.status)).length;

  const completed = jobs.filter((j) => j.status === 'complete');
  const otd = completed.length
    ? Math.round((completed.filter((j) => j.end_date && j.due_date && j.end_date <= j.due_date).length / completed.length) * 100)
    : 0;
  const manualExceptions = jobs.filter((j) => j.creation_mode === 'manual' && j.business_context_status !== 'linked').length;

  return {
    pipelineValue,
    weightedPipeline,
    wip,
    backlog,
    otd,
    manualExceptions,
    jobs,
    opps,
    routing,
  };
}

export async function fetchSalesMetrics() {
  const { data, error } = await supabase.from('opportunities').select('id, stage, contract_value, probability, bdm_name, expected_occupancy_date');
  if (error) throw error;

  const opps = data || [];
  const byStage = opps.reduce((acc, o) => {
    const k = o.stage || 'unknown';
    if (!acc[k]) acc[k] = { stage: k, count: 0, value: 0, weighted: 0 };
    acc[k].count += 1;
    acc[k].value += Number(o.contract_value || 0);
    acc[k].weighted += Number(o.contract_value || 0) * (Number(o.probability || 0) / 100);
    return acc;
  }, {});

  const byRep = opps.reduce((acc, o) => {
    const k = o.bdm_name || 'Unassigned';
    if (!acc[k]) acc[k] = { rep: k, count: 0, value: 0, weighted: 0 };
    acc[k].count += 1;
    acc[k].value += Number(o.contract_value || 0);
    acc[k].weighted += Number(o.contract_value || 0) * (Number(o.probability || 0) / 100);
    return acc;
  }, {});

  const closed = opps.filter((o) => ['lost', 'dead', 'handoff'].includes(o.stage));
  const won = opps.filter((o) => o.stage === 'handoff');
  const winRate = closed.length ? Math.round((won.length / closed.length) * 100) : 0;

  return {
    byStage: Object.values(byStage),
    byRep: Object.values(byRep).sort((a, b) => b.weighted - a.weighted),
    winRate,
    totalValue: opps.reduce((s, o) => s + Number(o.contract_value || 0), 0),
    weightedValue: opps.reduce((s, o) => s + Number(o.contract_value || 0) * (Number(o.probability || 0) / 100), 0),
  };
}

export async function fetchProductionMetrics() {
  const [jobsRes, milestoneRes] = await Promise.all([
    supabase.from('jobs').select('id, status, line_id, priority, progress, readiness_drawings, readiness_materials, readiness_permits, readiness_inspections'),
    supabase.from('job_milestones').select('id, job_id, status, planned_date, actual_date'),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (milestoneRes.error) throw milestoneRes.error;

  const jobs = jobsRes.data || [];
  const milestones = milestoneRes.data || [];

  const byStatus = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  const byLine = jobs.reduce((acc, j) => {
    acc[j.line_id || 'UNASSIGNED'] = (acc[j.line_id || 'UNASSIGNED'] || 0) + 1;
    return acc;
  }, {});

  const readiness = jobs.map((j) => {
    const score = [j.readiness_drawings, j.readiness_materials, j.readiness_permits, j.readiness_inspections].filter(Boolean).length * 25;
    return { id: j.id, score, status: j.status };
  });

  const risks = jobs.filter((j) => j.status === 'delayed' || j.priority === 'Critical');

  return {
    jobs,
    milestones,
    byStatus,
    byLine,
    readiness,
    risks,
  };
}

export async function fetchCapacityMetrics() {
  const [deptRes, rulesRes, stepsRes] = await Promise.all([
    supabase.from('departments').select('id, code, production_line_id').eq('is_active', true),
    supabase.from('capacity_rules').select('*').order('effective_date', { ascending: false }),
    supabase.from('job_routing_steps').select('id, department_id, planned_start, planned_end, planned_hours').not('planned_start', 'is', null),
  ]);

  if (deptRes.error) throw deptRes.error;
  if (rulesRes.error) throw rulesRes.error;
  if (stepsRes.error) throw stepsRes.error;

  return {
    departments: deptRes.data || [],
    rules: rulesRes.data || [],
    steps: stepsRes.data || [],
  };
}

export async function fetchOTDMetrics() {
  const { data, error } = await supabase.from('jobs').select('id, name, status, start_date, end_date, due_date, line_id, client');
  if (error) throw error;

  const completed = (data || []).filter((j) => j.status === 'complete');
  const onTime = completed.filter((j) => j.end_date && j.due_date && j.end_date <= j.due_date);
  const late = completed.filter((j) => j.end_date && j.due_date && j.end_date > j.due_date);

  return {
    totalCompleted: completed.length,
    onTime: onTime.length,
    late: late.length,
    otdPct: completed.length ? Math.round((onTime.length / completed.length) * 100) : 0,
    lateJobs: late,
  };
}

export function defaultDateRange() {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  return { from: fmtDate(from), to: fmtDate(now) };
}
