import { supabase } from './supabase.js';

export async function fetchQuotes({ status, search } = {}) {
  let query = supabase
    .from('quotes')
    .select('id, quote_number, title, status, total, margin_pct, revision, issued_date, valid_until, opportunity_id, created_at, opportunities(name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`quote_number.ilike.%${search}%,title.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

export async function fetchQuoteById(id) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, opportunities(id, name, stage), quote_line_items(*), quote_revisions(*), quote_approvals(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createQuote(payload) {
  const { data, error } = await supabase.from('quotes').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateQuote(id, payload) {
  const { data, error } = await supabase.from('quotes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function replaceQuoteLineItems(quoteId, items) {
  const { error: delError } = await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);
  if (delError) throw delError;

  if (!items?.length) return [];

  const rows = items.map((item, index) => ({
    quote_id: quoteId,
    sort_order: index,
    category: item.category || 'other',
    description: item.description || 'Line Item',
    quantity: Number(item.quantity || 0),
    unit_cost: Number(item.unit_cost || 0),
    unit_price: Number(item.unit_price || 0),
    notes: item.notes || null,
  }));

  const { data, error } = await supabase.from('quote_line_items').insert(rows).select('*').order('sort_order');
  if (error) throw error;
  return data;
}

export async function createQuoteRevision(quoteId, changeSummary, snapshot) {
  const { data: lastRev, error: lastRevErr } = await supabase
    .from('quote_revisions')
    .select('revision_number')
    .eq('quote_id', quoteId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRevErr) throw lastRevErr;

  const revisionNumber = (lastRev?.revision_number ?? 0) + 1;

  const { data, error } = await supabase
    .from('quote_revisions')
    .insert({
      quote_id: quoteId,
      revision_number: revisionNumber,
      change_summary: changeSummary || null,
      snapshot,
    })
    .select('*')
    .single();
  if (error) throw error;

  await updateQuote(quoteId, { revision: revisionNumber });
  return data;
}

export async function fetchApprovalQueue() {
  const { data, error } = await supabase
    .from('quote_approvals')
    .select('*, quotes(id, quote_number, title, status, total)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertApprovalStep(payload) {
  const { data, error } = await supabase
    .from('quote_approvals')
    .upsert(payload, { onConflict: 'quote_id,step' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function decideApproval(id, status, comments) {
  const { data, error } = await supabase
    .from('quote_approvals')
    .update({ status, comments: comments ?? null, decision_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
