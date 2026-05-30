import { supabase } from './supabase.js';

export async function fetchCapacityData() {
  const [deptsRes, rulesRes, blocksRes, routingRes] = await Promise.all([
    supabase.from('departments').select('*').eq('is_active', true).order('production_line_id').order('sort_order'),
    supabase.from('capacity_rules').select('*').order('effective_date', { ascending: false }),
    supabase.from('capacity_blocks').select('*').order('block_date', { ascending: true }),
    supabase.from('job_routing_steps').select('id, job_id, department_id, planned_start, planned_end, planned_hours, status').not('planned_start', 'is', null),
  ]);

  if (deptsRes.error) throw deptsRes.error;
  if (rulesRes.error) throw rulesRes.error;
  if (blocksRes.error) throw blocksRes.error;
  if (routingRes.error) throw routingRes.error;

  return {
    departments: deptsRes.data ?? [],
    rules: rulesRes.data ?? [],
    blocks: blocksRes.data ?? [],
    routingSteps: routingRes.data ?? [],
  };
}

export async function upsertCapacityRule(payload) {
  const { data, error } = await supabase.from('capacity_rules').upsert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function createCapacityBlock(payload) {
  const { data, error } = await supabase.from('capacity_blocks').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}
