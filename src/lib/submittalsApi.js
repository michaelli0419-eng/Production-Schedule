import { supabase } from "./supabase.js";

export function dbRowToSubmittal(row) {
  return {
    id:               row.id,
    jobId:            row.job_id,
    type:             row.type             ?? "general",
    title:            row.title            ?? "",
    revNumber:        row.rev_number       ?? 1,
    status:           row.status           ?? "not_sent",
    sentDate:         row.sent_date        ?? null,
    receivedDate:     row.received_date    ?? null,
    approvedDate:     row.approved_date    ?? null,
    reviewer:         row.reviewer         ?? "",
    reviewerContactId: row.reviewer_contact_id ?? null,
    notes:            row.notes            ?? "",
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

export function submittalToDbRow(sub) {
  return {
    id:                  sub.id,
    job_id:              sub.jobId,
    type:                sub.type             || "general",
    title:               sub.title            || null,
    rev_number:          sub.revNumber        ?? 1,
    status:              sub.status           || "not_sent",
    sent_date:           sub.sentDate         || null,
    received_date:       sub.receivedDate     || null,
    approved_date:       sub.approvedDate     || null,
    reviewer:            sub.reviewer         || null,
    reviewer_contact_id: sub.reviewerContactId || null,
    notes:               sub.notes            || null,
  };
}

export async function fetchSubmittals(jobId) {
  let query = supabase.from("submittals").select("*").order("created_at", { ascending: true });
  if (jobId) query = query.eq("job_id", jobId);
  const { data, error } = await query;
  if (error) throw new Error(`fetchSubmittals: ${error.message}`);
  return (data ?? []).map(dbRowToSubmittal);
}

export async function upsertSubmittal(sub) {
  const { data, error } = await supabase
    .from("submittals")
    .upsert(submittalToDbRow(sub), { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(`upsertSubmittal: ${error.message}`);
  return dbRowToSubmittal(data);
}

export async function deleteSubmittal(id) {
  const { error } = await supabase.from("submittals").delete().eq("id", id);
  if (error) throw new Error(`deleteSubmittal(${id}): ${error.message}`);
}
