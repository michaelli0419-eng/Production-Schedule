import { supabase } from './supabase.js';

export async function invokeNetSuiteSync(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('netsuite-sync', {
    body: { action, ...payload },
  });
  if (error) throw error;
  return data;
}

export async function invokeProcoreSync(payload = {}) {
  const { data, error } = await supabase.functions.invoke('procore-sync', {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export async function fetchNetSuiteSyncLog(limit = 200) {
  const { data, error } = await supabase
    .from('netsuite_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchProcoreSyncLog(limit = 200) {
  const { data, error } = await supabase
    .from('procore_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchWebhookEvents(limit = 200) {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function retryWebhookEvent(id) {
  const { data, error } = await supabase
    .from('webhook_events')
    .update({
      processing_status: 'pending',
      error_message: null,
      processed_at: null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchJobsForIntegration(search = '') {
  let query = supabase.from('jobs').select('id, job_number, name, procore_project_id').order('job_number', { ascending: true }).limit(200);
  if (search) query = query.or(`job_number.ilike.%${search}%,name.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchApprovedQuotes() {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, title, status, total, opportunity_id')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function fetchConfirmedPOs() {
  const { data, error } = await supabase
    .from('procurement_orders')
    .select('id, po_number, status, total_amount, supplier_name')
    .in('status', ['approved', 'ordered', 'partially_received'])
    .order('updated_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
