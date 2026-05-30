import { supabase } from './supabase.js';

export async function fetchIntakeDrafts(status) {
  let query = supabase.from('intake_drafts').select('*').order('created_at', { ascending: false }).limit(200);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function parseIntakeDocument(payload) {
  const { data, error } = await supabase.functions.invoke('ai-intake', {
    body: payload,
  });
  if (error) throw error;
  return data;
}

export async function updateIntakeDraft(id, patch) {
  const { data, error } = await supabase
    .from('intake_drafts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function convertDraftToEntity({ draftId, entityType, payload }) {
  let created;

  if (entityType === 'lead') {
    const { data, error } = await supabase.from('leads').insert(payload).select('id').single();
    if (error) throw error;
    created = data;
  } else {
    const { data, error } = await supabase.from('opportunities').insert(payload).select('id').single();
    if (error) throw error;
    created = data;
  }

  await updateIntakeDraft(draftId, {
    status: 'converted',
    converted_entity_type: entityType,
    converted_entity_id: created.id,
    reviewed_at: new Date().toISOString(),
  });

  return created;
}
