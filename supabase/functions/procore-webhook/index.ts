/**
 * Procore Webhook Handler — Supabase Edge Function
 *
 * Receives webhook events from Procore and updates the SCM Hub database:
 *   - Submittal status changes → updates submittals table + master_dsa_status on jobs
 *   - Daily log entries → appends to master_pm_update on the matching job
 *
 * Deploy: supabase functions deploy procore-webhook
 *
 * Configure in Procore:
 *   Webhook URL: https://ixbffxowwvpzzuamvgix.supabase.co/functions/v1/procore-webhook
 *   Secret header: x-procore-signature  (set PROCORE_WEBHOOK_SECRET env var)
 *   Events: submittals.update, submittals.create, daily_logs.create
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("PROCORE_WEBHOOK_SECRET") ?? "";

// ── Procore submittal status → SCM Hub DSA status string ─────────────────────
function mapSubmittalStatus(procoreStatus: string): string {
  const map: Record<string, string> = {
    "approved":              "Approved",
    "approved_as_noted":     "Approved as Noted",
    "revise_and_resubmit":   "Revise & Resubmit",
    "rejected":              "Rejected",
    "under_review":          "Under Review",
    "draft":                 "Draft",
    "submitted":             "Submitted",
  };
  return map[procoreStatus?.toLowerCase()] ?? procoreStatus ?? "Unknown";
}

// ── Find SCM job by Procore project custom field or job number ────────────────
async function findJobId(procoreProjectId: number, jobNumber?: string): Promise<string | null> {
  // First try matching by job_number
  if (jobNumber) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", String(jobNumber))
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Fall back to procore_project_id stored in a future jobs.procore_project_id column
  // For now, check the notes field for "procore:" prefix set during setup
  const { data } = await supabase
    .from("jobs")
    .select("id, notes")
    .ilike("notes", `%procore:${procoreProjectId}%`)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/** Generate a deterministic UUID from a Procore resource ID — format: 8-4-4-4-12 */
function procoreUuid(procoreId: number): string {
  const hex = procoreId.toString(16).padStart(12, "0");
  return `5f6f7263-7072-4f63-${hex.slice(0, 4)}-${hex}`;
}

async function handleSubmittal(payload: any) {
  const sub = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? sub.project_id;
  const jobNumber = payload.job_number ?? sub.spec_section?.project_number;

  const jobId = await findJobId(procoreProjectId, jobNumber);

  // Upsert into the submittals table only when we have a matched job
  if (!jobId) {
    console.warn(`No job matched for project_id=${procoreProjectId} job_number=${jobNumber} — skipping submittal upsert`);
  } else {
  const submittalRow: any = {
    id: procoreUuid(sub.id),
    job_id: jobId,
    type: "submittal",
    title: sub.title ?? sub.spec_section?.description ?? "Procore Submittal",
    rev_number: sub.revision ?? 1,
    status: mapSubmittalToStatus(sub.status),
    sent_date:      sub.submitted_at    ? sub.submitted_at.slice(0, 10) : null,
    received_date:  sub.received_at     ? sub.received_at.slice(0, 10)  : null,
    approved_date:  sub.approved_at     ? sub.approved_at.slice(0, 10)  : null,
    reviewer:       sub.responsible_contractor?.name ?? null,
    notes:          sub.description ?? null,
  };

  const { error: subError } = await supabase
    .from("submittals")
    .upsert(submittalRow, { onConflict: "id" });

  if (subError) console.error("submittals upsert error:", subError.message);
  } // end if (jobId) for submittal upsert

  // Update master DSA/submittal fields on the job
  if (jobId) {
    const patch: any = {};

    if (sub.submitted_at) patch.master_submittals_out = sub.submitted_at.slice(0, 10);
    if (sub.received_at)  patch.master_submittals_received = sub.received_at.slice(0, 10);
    if (sub.status)       patch.master_dsa_status = mapSubmittalStatus(sub.status);
    if (sub.approved_at)  patch.master_dsa_approval = sub.approved_at.slice(0, 10);

    if (Object.keys(patch).length) {
      const { error: jobError } = await supabase
        .from("jobs")
        .update(patch)
        .eq("id", jobId);
      if (jobError) console.error("jobs update error:", jobError.message);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "submittal",
    entity_id:   String(sub.id),
    action:      "procore_submittal_sync",
    detail:      { procore_status: sub.status, job_id: jobId, procore_project_id: procoreProjectId },
    user_name:   "Procore Sync",
  });
}

function mapSubmittalToStatus(status: string): string {
  const map: Record<string, string> = {
    "draft": "not_sent",
    "submitted": "sent",
    "under_review": "under_review",
    "approved": "approved",
    "approved_as_noted": "approved",
    "revise_and_resubmit": "resubmit_required",
    "rejected": "rejected",
  };
  return map[status?.toLowerCase()] ?? "not_sent";
}

async function handleDailyLog(payload: any) {
  const log = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? log.project_id;
  const jobNumber = payload.job_number;

  const jobId = await findJobId(procoreProjectId, jobNumber);
  if (!jobId) return; // can't match — skip

  // Append the daily log note to master_pm_update
  const { data: job } = await supabase
    .from("jobs")
    .select("master_pm_update")
    .eq("id", jobId)
    .maybeSingle();

  const date = log.date ?? new Date().toISOString().slice(0, 10);
  const note = `[${date} via Procore] ${log.weather ?? ""} ${log.notes ?? log.description ?? ""}`.trim();
  const updated = [job?.master_pm_update, note].filter(Boolean).join("\n\n");

  await supabase
    .from("jobs")
    .update({ master_pm_update: updated })
    .eq("id", jobId);

  await supabase.from("activity_log").insert({
    entity_type: "job",
    entity_id:   jobId,
    action:      "procore_daily_log_synced",
    detail:      { date, procore_project_id: procoreProjectId },
    user_name:   "Procore Sync",
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-procore-signature, content-type" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify Procore webhook signature if secret is configured
  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("x-procore-signature") ?? "";
    // Procore signs with HMAC-SHA256; in production verify sig here
    // For now accept if header is present
    if (!sig) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType: string = body.event_type ?? body.type ?? "";

  try {
    if (eventType.includes("submittal")) {
      await handleSubmittal(body);
    } else if (eventType.includes("daily_log")) {
      await handleDailyLog(body);
    } else {
      console.log("Unhandled event type:", eventType);
    }
  } catch (err: any) {
    console.error("Handler error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, event: eventType }), {
    headers: { "Content-Type": "application/json" },
  });
});
