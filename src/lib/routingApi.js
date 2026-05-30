import { supabase } from './supabase.js';

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('production_line_id', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRoutingTemplates() {
  const { data, error } = await supabase
    .from('routing_templates')
    .select('*, routing_steps(count)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRoutingTemplate(id) {
  const { data, error } = await supabase
    .from('routing_templates')
    .select('*, routing_steps(*, departments(id, code, name, production_line_id))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createRoutingTemplate(payload) {
  const { data, error } = await supabase.from('routing_templates').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateRoutingTemplate(id, payload) {
  const { data, error } = await supabase.from('routing_templates').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function createRoutingStep(payload) {
  const { data, error } = await supabase.from('routing_steps').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateRoutingStep(id, payload) {
  const { data, error } = await supabase.from('routing_steps').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteRoutingStep(id) {
  const { error } = await supabase.from('routing_steps').delete().eq('id', id);
  if (error) throw error;
}
