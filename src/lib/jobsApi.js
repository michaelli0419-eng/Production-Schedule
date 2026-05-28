/**
 * Bidirectional mapping between the Supabase `jobs` table rows and the
 * JS job objects used by the scheduler component.
 *
 * DB column names use snake_case.
 * JS job fields use camelCase (matching the existing component exactly).
 */
import { supabase } from "./supabase.js";

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultTopsetCompleteDate(start) {
  return start ? addDays(start, 30) : "2026-01-31";
}

// ─── DB row → JS job ─────────────────────────────────────────────────────────

export function dbRowToJob(row) {
  return {
    id:         row.id,
    jobNumber:  row.job_number   ?? "",
    name:       row.name,
    client:     row.client       ?? "",
    line:       row.line_id      ?? "L1",
    start:      row.start_date,           // already a string from Supabase
    offLine:    defaultTopsetCompleteDate(row.start_date),
    end:        row.end_date,
    due:        row.due_date     ?? row.end_date,
    color:      row.color        ?? "#2563eb",
    status:     row.status       ?? "forecast",
    modules:    row.modules      ?? 12,
    crew:       row.crew         ?? 12,
    priority:   row.priority     ?? "Medium",
    progress:   row.progress     ?? 0,
    readiness: {
      drawings:    row.readiness_drawings    ?? false,
      materials:   row.readiness_materials   ?? false,
      permits:     row.readiness_permits     ?? false,
      inspections: row.readiness_inspections ?? false,
    },
    notes:      row.notes        ?? "",
    sourceType:  row.source_type  ?? "",
    sourceSheet: row.source_sheet ?? "",
    sourceRow:   row.source_row   ?? null,
    master: {
      contract:            row.master_contract             ?? "",
      submittalsOut:       row.master_submittals_out       ?? "",
      submittalsReceived:  row.master_submittals_received  ?? "",
      dsaStatus:           row.master_dsa_status           ?? "",
      dsaRedlines:         row.master_dsa_redlines         ?? "",
      dsaApproval:         row.master_dsa_approval         ?? "",
      inspector:           row.master_inspector            ?? "",
      jobCard:             row.master_job_card             ?? "",
      lab:                 row.master_lab                  ?? "",
      subcontractStatus:   row.master_subcontract_status   ?? "",
      openItems:           row.master_open_items           ?? "",
      pmUpdate:            row.master_pm_update            ?? "",
    },
  };
}

// ─── JS job → DB row ─────────────────────────────────────────────────────────

export function jobToDbRow(job) {
  return {
    id:             job.id,
    job_number:     job.jobNumber  || null,
    name:           job.name,
    client:         job.client     || null,
    line_id:        job.line       || null,
    start_date:     job.start,
    end_date:       job.end,
    due_date:       job.due        || null,
    color:          job.color      || "#2563eb",
    status:         job.status     || "forecast",
    modules:        job.modules    || 12,
    crew:           job.crew       || 12,
    priority:       job.priority   || "Medium",
    progress:       job.progress   ?? 0,

    readiness_drawings:    job.readiness?.drawings    ?? false,
    readiness_materials:   job.readiness?.materials   ?? false,
    readiness_permits:     job.readiness?.permits     ?? false,
    readiness_inspections: job.readiness?.inspections ?? false,

    notes:          job.notes      || null,
    source_type:    job.sourceType  || null,
    source_sheet:   job.sourceSheet || null,
    source_row:     job.sourceRow   || null,

    master_contract:             job.master?.contract            || null,
    master_submittals_out:       job.master?.submittalsOut       || null,
    master_submittals_received:  job.master?.submittalsReceived  || null,
    master_dsa_status:           job.master?.dsaStatus           || null,
    master_dsa_redlines:         job.master?.dsaRedlines         || null,
    master_dsa_approval:         job.master?.dsaApproval         || null,
    master_inspector:            job.master?.inspector           || null,
    master_job_card:             job.master?.jobCard             || null,
    master_lab:                  job.master?.lab                 || null,
    master_subcontract_status:   job.master?.subcontractStatus   || null,
    master_open_items:           job.master?.openItems           || null,
    master_pm_update:            job.master?.pmUpdate            || null,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Fetch all jobs ordered by start date */
export async function fetchAllJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) throw new Error(`fetchAllJobs: ${error.message}`);
  return (data ?? []).map(dbRowToJob);
}

/** Insert or update a single job */
export async function upsertJob(job) {
  const { error } = await supabase
    .from("jobs")
    .upsert(jobToDbRow(job), { onConflict: "id" });

  if (error) throw new Error(`upsertJob(${job.id}): ${error.message}`);
}

/** Upsert many jobs in one call (used for Excel bulk import) */
export async function upsertJobs(jobs) {
  if (!jobs.length) return;
  const rows = jobs.map(jobToDbRow);
  const { error } = await supabase
    .from("jobs")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(`upsertJobs: ${error.message}`);
}

/** Delete a single job by id */
export async function deleteJob(id) {
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`deleteJob(${id}): ${error.message}`);
}
