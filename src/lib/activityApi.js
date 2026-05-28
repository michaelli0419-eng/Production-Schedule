import { supabase } from "./supabase.js";

/**
 * Log an activity entry to the activity_log table.
 * @param {string} entityType  - 'job' | 'deal' | 'submittal' | 'client'
 * @param {string} entityId    - the entity's id (text or UUID)
 * @param {string} action      - e.g. 'status_changed', 'created', 'converted'
 * @param {object} detail      - arbitrary JSON for extra context
 * @param {object} user        - { id, name } from currentUser
 */
export async function logActivity(entityType, entityId, action, detail = {}, user = {}) {
  const { error } = await supabase.from("activity_log").insert({
    entity_type: entityType,
    entity_id:   String(entityId),
    user_id:     user?.id     || null,
    user_name:   user?.name   || null,
    action,
    detail,
  });
  if (error) console.error("[activityApi] logActivity failed:", error.message);
}

export async function fetchActivity(entityType, entityId, limit = 50) {
  let query = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId)   query = query.eq("entity_id", String(entityId));
  const { data, error } = await query;
  if (error) throw new Error(`fetchActivity: ${error.message}`);
  return data ?? [];
}
