import { supabase } from '../../../lib/supabase.js';

function toDate(value) { return value ? new Date(value) : null; }
function toIso(d) { return d.toISOString(); }

export function topologicalSort(steps) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const incoming = new Map(steps.map((s) => [s.id, 0]));
  const edges = new Map(steps.map((s) => [s.id, []]));

  for (const s of steps) {
    if (!s.predecessor_id) continue;
    if (!byId.has(s.predecessor_id)) continue;
    edges.get(s.predecessor_id).push(s.id);
    incoming.set(s.id, (incoming.get(s.id) || 0) + 1);
  }

  const queue = [...steps.filter((s) => (incoming.get(s.id) || 0) === 0)].sort((a, b) => a.step_number - b.step_number);
  const out = [];

  while (queue.length) {
    const node = queue.shift();
    out.push(node);
    for (const nextId of edges.get(node.id) || []) {
      incoming.set(nextId, (incoming.get(nextId) || 0) - 1);
      if ((incoming.get(nextId) || 0) === 0) queue.push(byId.get(nextId));
    }
    queue.sort((a, b) => a.step_number - b.step_number);
  }

  if (out.length !== steps.length) return [...steps].sort((a, b) => a.step_number - b.step_number);
  return out;
}

export function asapScheduler(steps, startDate) {
  const sorted = topologicalSort(steps);
  const byId = new Map();
  const schedule = [];

  for (const step of sorted) {
    const pred = step.predecessor_id ? byId.get(step.predecessor_id) : null;
    const baseStart = pred?.planned_end ? toDate(pred.planned_end) : new Date(startDate);
    const lagHours = Number(step.lag_hours || 0);
    const durationHours = Number(step.duration_hours || step.planned_hours || 8);
    const plannedStart = new Date(baseStart.getTime() + lagHours * 3600 * 1000);
    const plannedEnd = new Date(plannedStart.getTime() + durationHours * 3600 * 1000);

    const item = {
      id: step.id,
      step_number: step.step_number,
      planned_start: toIso(plannedStart),
      planned_end: toIso(plannedEnd),
      planned_hours: durationHours,
    };

    byId.set(step.id, item);
    schedule.push(item);
  }

  return schedule;
}

export function leveledScheduler(steps, startDate) {
  const sorted = topologicalSort(steps);
  const deptCursor = new Map();
  const byId = new Map();
  const out = [];

  for (const step of sorted) {
    const pred = step.predecessor_id ? byId.get(step.predecessor_id) : null;
    const predStart = pred?.planned_end ? toDate(pred.planned_end) : new Date(startDate);
    const deptStart = step.department_id && deptCursor.get(step.department_id)
      ? toDate(deptCursor.get(step.department_id))
      : new Date(startDate);

    const lagHours = Number(step.lag_hours || 0);
    const earliest = new Date(Math.max(predStart.getTime(), deptStart.getTime()) + lagHours * 3600 * 1000);
    const durationHours = Number(step.duration_hours || step.planned_hours || 8);
    const plannedEnd = new Date(earliest.getTime() + durationHours * 3600 * 1000);

    const item = {
      id: step.id,
      step_number: step.step_number,
      planned_start: toIso(earliest),
      planned_end: toIso(plannedEnd),
      planned_hours: durationHours,
    };

    if (step.department_id) deptCursor.set(step.department_id, item.planned_end);
    byId.set(step.id, item);
    out.push(item);
  }

  return out;
}

export function detectConflicts(steps) {
  const conflicts = [];
  const byDept = new Map();

  for (const s of steps) {
    const dept = s.department_id || 'UNASSIGNED';
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept).push(s);
  }

  for (const [dept, arr] of byDept.entries()) {
    const sorted = [...arr].sort((a, b) => new Date(a.planned_start) - new Date(b.planned_start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (new Date(a.planned_end) > new Date(b.planned_start)) {
        conflicts.push({
          conflict_type: 'line_overlap',
          severity: 'warning',
          department_id: dept,
          step_a_id: a.id,
          step_b_id: b.id,
          detail: `Overlap in department ${dept} between step #${a.step_number} and #${b.step_number}`,
        });
      }
    }
  }

  return conflicts;
}

export async function runScheduler({ strategy = 'leveled', jobIds = [] }) {
  const query = supabase
    .from('job_routing_steps')
    .select('*')
    .order('step_number', { ascending: true });
  const { data: steps, error } = jobIds.length
    ? await query.in('job_id', jobIds)
    : await query;
  if (error) throw error;

  const jobs = new Map();
  for (const s of steps || []) {
    if (!jobs.has(s.job_id)) jobs.set(s.job_id, []);
    jobs.get(s.job_id).push(s);
  }

  const schedule = [];
  const now = new Date();
  for (const [jobId, jobSteps] of jobs.entries()) {
    const engine = strategy === 'asap' ? asapScheduler : leveledScheduler;
    const scheduled = engine(jobSteps, now);
    for (const s of scheduled) schedule.push({ job_id: jobId, ...s });
  }

  const conflicts = detectConflicts(schedule.map((s) => ({ ...s, department_id: (steps || []).find((x) => x.id === s.id)?.department_id })));

  return { schedule, conflicts };
}

export async function applySchedule(schedule) {
  for (const row of schedule) {
    const { error } = await supabase
      .from('job_routing_steps')
      .update({
        planned_start: row.planned_start,
        planned_end: row.planned_end,
        planned_hours: row.planned_hours,
      })
      .eq('id', row.id);
    if (error) throw error;
  }
}
