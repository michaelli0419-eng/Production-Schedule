/**
 * Procore Webhook Handler — Supabase Edge Function  v2
 *
 * Handles all Procore webhook events and maps them to SCM Hub tables:
 *
 *  submittals.create/update    → submittals table + jobs DSA/submittal fields
 *  daily_logs.create           → appends to jobs.master_pm_update
 *  rfis.create/update          → procore_rfis table + jobs.rfi_open_count
 *  punch_items.create/update   → procore_punch_items + jobs.punch_open_count
 *  change_events.create/update → procore_change_events + jobs.change_event_count
 *  checklists.create/update    → procore_inspections + jobs readiness flags
 *  observations.create/update  → procore_observations + jobs.observation_open_count
 *  meetings.create             → appends to jobs.master_pm_update
 *  work_order_contracts.update → jobs subcontract fields
 *  prime_contract.update       → jobs prime contract fields
 *
 * Deploy:
 *   npx supabase functions deploy procore-webhook --project-ref ixbffxowwvpzzuamvgix --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("PROCORE_WEBHOOK_SECRET") ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a deterministic UUID from a Procore resource type + ID */
function procoreUuid(prefix: string, procoreId: number): string {
  const hex = procoreId.toString(16).padStart(12, "0");
  const prefixHex = [...prefix.slice(0, 4)].map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("").slice(0, 8).padEnd(8, "0");
  return `${prefixHex}-7072-4f63-${hex.slice(0, 4)}-${hex}`;
}

function d(val: string | null | undefined): string | null {
  return val ? val.slice(0, 10) : null;
}

function str(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "object") return val.name ?? val.label ?? JSON.stringify(val);
  return String(val);
}

/** Find SCM job by job_number or procore_project_id or notes tag */
async function findJobId(procoreProjectId: number, jobNumber?: string): Promise<string | null> {
  if (jobNumber) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("job_number", String(jobNumber))
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Try direct procore_project_id column
  if (procoreProjectId) {
    const { data } = await supabase
      .from("jobs")
      .select("id")
      .eq("procore_project_id", procoreProjectId)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Fall back to notes tag
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .ilike("notes", `%procore:${procoreProjectId}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Recount open/overdue items and patch back to jobs row */
async function refreshJobCounts(jobId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [rfis, punches, ces, obs] = await Promise.all([
    supabase.from("procore_rfis").select("id, status, due_date").eq("job_id", jobId),
    supabase.from("procore_punch_items").select("id, status, schedule_impact_days").eq("job_id", jobId),
    supabase.from("procore_change_events").select("id, status").eq("job_id", jobId),
    supabase.from("procore_observations").select("id, status").eq("job_id", jobId),
  ]);

  const rfiOpen = (rfis.data ?? []).filter(r => r.status !== "closed").length;
  const rfiOverdue = (rfis.data ?? []).filter(r => r.status !== "closed" && r.due_date && r.due_date < today).length;
  const punchOpen = (punches.data ?? []).filter(p => p.status === "open" || p.status === "ready_for_review").length;
  const punchImpact = (punches.data ?? []).reduce((s: number, p: any) => s + (p.schedule_impact_days ?? 0), 0);
  const ceCount = (ces.data ?? []).filter(c => c.status !== "void" && c.status !== "closed").length;
  const obsOpen = (obs.data ?? []).filter(o => o.status !== "closed").length;

  await supabase.from("jobs").update({
    rfi_open_count: rfiOpen,
    rfi_overdue_count: rfiOverdue,
    punch_open_count: punchOpen,
    punch_schedule_impact_days: punchImpact,
    change_event_count: ceCount,
    observation_open_count: obsOpen,
  }).eq("id", jobId);
}

async function logActivity(entityType: string, entityId: string, action: string, detail: object, jobId: string | null) {
  await supabase.from("activity_log").insert({
    entity_type: entityType,
    entity_id:   entityId,
    action,
    detail:      { ...detail, job_id: jobId },
    user_name:   "Procore Sync",
  });
}

// ── Event handlers ────────────────────────────────────────────────────────────

// ── Submittals ────────────────────────────────────────────────────────────────

function mapDsaStatus(s: string): string {
  const m: Record<string, string> = {
    approved: "Approved", approved_as_noted: "Approved as Noted",
    revise_and_resubmit: "Revise & Resubmit", rejected: "Rejected",
    under_review: "Under Review", draft: "Draft", submitted: "Submitted",
  };
  return m[s?.toLowerCase()] ?? s ?? "Unknown";
}

function mapSubmittalStatus(s: string): string {
  const m: Record<string, string> = {
    draft: "not_sent", submitted: "sent", under_review: "under_review",
    approved: "approved", approved_as_noted: "approved",
    revise_and_resubmit: "resubmit_required", rejected: "rejected",
  };
  return m[s?.toLowerCase()] ?? "not_sent";
}

async function handleSubmittal(payload: any) {
  const sub = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? sub.project_id;
  const jobNumber = payload.job_number ?? sub.spec_section?.project_number;
  const jobId = await findJobId(procoreProjectId, jobNumber);

  if (jobId) {
    await supabase.from("submittals").upsert({
      id:            procoreUuid("subm", sub.id),
      job_id:        jobId,
      type:          "submittal",
      title:         sub.title ?? sub.spec_section?.description ?? "Procore Submittal",
      rev_number:    sub.revision ?? 1,
      status:        mapSubmittalStatus(sub.status),
      sent_date:     d(sub.submitted_at),
      received_date: d(sub.received_at),
      approved_date: d(sub.approved_at),
      reviewer:      sub.responsible_contractor?.name ?? null,
      notes:         sub.description ?? null,
    }, { onConflict: "id" });

    const patch: any = {};
    if (sub.submitted_at) patch.master_submittals_out      = d(sub.submitted_at);
    if (sub.received_at)  patch.master_submittals_received = d(sub.received_at);
    if (sub.status)       patch.master_dsa_status          = mapDsaStatus(sub.status);
    if (sub.approved_at)  patch.master_dsa_approval        = d(sub.approved_at);
    if (Object.keys(patch).length) {
      await supabase.from("jobs").update(patch).eq("id", jobId);
    }
  }

  await logActivity("submittal", String(sub.id), "procore_submittal_sync",
    { procore_status: sub.status, procore_project_id: procoreProjectId }, jobId);
}

// ── Daily Logs ────────────────────────────────────────────────────────────────

async function handleDailyLog(payload: any) {
  const log = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? log.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);
  if (!jobId) return;

  const { data: job } = await supabase.from("jobs").select("master_pm_update").eq("id", jobId).maybeSingle();
  const date = log.date ?? new Date().toISOString().slice(0, 10);
  const note = `[${date} via Procore Daily Log] ${log.weather ?? ""} ${log.notes ?? log.description ?? ""}`.trim();
  await supabase.from("jobs").update({ master_pm_update: [job?.master_pm_update, note].filter(Boolean).join("\n\n") }).eq("id", jobId);
  await logActivity("job", jobId, "procore_daily_log_synced", { date, procore_project_id: procoreProjectId }, jobId);
}

// ── RFIs ──────────────────────────────────────────────────────────────────────

async function handleRfi(payload: any) {
  const rfi = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? rfi.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);

  if (jobId) {
    await supabase.from("procore_rfis").upsert({
      id:           procoreUuid("rfi_", rfi.id),
      job_id:       jobId,
      procore_id:   rfi.id,
      number:       str(rfi.number),
      title:        rfi.subject ?? rfi.title ?? null,
      status:       rfi.status ?? null,
      priority:     rfi.priority ?? null,
      question:     rfi.question ?? null,
      answer:       rfi.answer ?? null,
      due_date:     d(rfi.due_date),
      closed_at:    d(rfi.closed_at),
      ball_in_court: str(rfi.ball_in_court),
      spec_section: str(rfi.spec_section),
      assignee:     str(rfi.assignee),
    }, { onConflict: "id" });

    await refreshJobCounts(jobId);
  }

  await logActivity("rfi", String(rfi.id), "procore_rfi_sync",
    { status: rfi.status, number: rfi.number, procore_project_id: procoreProjectId }, jobId);
}

// ── Punch Items ───────────────────────────────────────────────────────────────

async function handlePunchItem(payload: any) {
  const item = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? item.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);

  if (jobId) {
    await supabase.from("procore_punch_items").upsert({
      id:                   procoreUuid("pnch", item.id),
      job_id:               jobId,
      procore_id:           item.id,
      name:                 item.name ?? null,
      status:               item.status ?? null,
      priority:             item.priority ?? null,
      due_date:             d(item.due_date),
      closed_at:            d(item.closed_at),
      schedule_impact:      item.schedule_impact ?? null,
      schedule_impact_days: item.schedule_impact_days ?? 0,
      cost_impact:          item.cost_impact ?? null,
      cost_impact_amount:   item.cost_impact_amount ?? 0,
      assignee:             str(item.punch_item_manager ?? item.final_approver),
      trade:                str(item.trade),
      location:             str(item.location),
    }, { onConflict: "id" });

    await refreshJobCounts(jobId);
  }

  await logActivity("punch_item", String(item.id), "procore_punch_item_sync",
    { status: item.status, priority: item.priority, procore_project_id: procoreProjectId }, jobId);
}

// ── Change Events ─────────────────────────────────────────────────────────────

async function handleChangeEvent(payload: any) {
  const ce = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? ce.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);

  if (jobId) {
    await supabase.from("procore_change_events").upsert({
      id:            procoreUuid("chev", ce.id),
      job_id:        jobId,
      procore_id:    ce.id,
      number:        str(ce.number ?? ce.alphanumeric_number),
      title:         ce.title ?? null,
      status:        str(ce.status) ?? null,
      scope:         ce.scope ?? ce.event_scope ?? null,
      change_type:   str(ce.change_type ?? ce.event_type),
      change_reason: str(ce.change_reason ?? ce.change_order_change_reason),
      description:   ce.description ?? null,
    }, { onConflict: "id" });

    await refreshJobCounts(jobId);
  }

  await logActivity("change_event", String(ce.id), "procore_change_event_sync",
    { status: str(ce.status), title: ce.title, procore_project_id: procoreProjectId }, jobId);
}

// ── Inspections / Checklists ──────────────────────────────────────────────────

async function handleInspection(payload: any) {
  const insp = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? insp.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);

  if (jobId) {
    const deficient = insp.deficient_item_count ?? 0;
    const conforming = insp.conforming_item_count ?? insp.yes_item_count ?? 0;
    const total = insp.item_count ?? insp.item_total ?? 0;

    await supabase.from("procore_inspections").upsert({
      id:                     procoreUuid("insp", insp.id),
      job_id:                 jobId,
      procore_id:             insp.id,
      name:                   insp.name ?? null,
      status:                 insp.status ?? null,
      inspection_date:        d(insp.inspection_date),
      due_at:                 d(insp.due_at),
      inspector:              str(insp.inspectors?.[0] ?? insp.created_by),
      responsible_contractor: str(insp.responsible_contractor),
      conforming_count:       conforming,
      deficient_count:        deficient,
      total_items:            total,
    }, { onConflict: "id" });

    // Auto-uncheck QA readiness if there are deficient items
    if (deficient > 0) {
      await supabase.from("jobs").update({ readiness_inspections: false }).eq("id", jobId);
    } else if (insp.status === "closed" && deficient === 0 && total > 0) {
      await supabase.from("jobs").update({ readiness_inspections: true }).eq("id", jobId);
    }

    // Update deficient count on jobs
    const { data: allInsp } = await supabase
      .from("procore_inspections")
      .select("deficient_count")
      .eq("job_id", jobId);
    const totalDeficient = (allInsp ?? []).reduce((s: number, i: any) => s + (i.deficient_count ?? 0), 0);
    await supabase.from("jobs").update({ inspection_deficient_count: totalDeficient }).eq("id", jobId);
  }

  await logActivity("inspection", String(insp.id), "procore_inspection_sync",
    { status: insp.status, deficient: insp.deficient_item_count, procore_project_id: procoreProjectId }, jobId);
}

// ── Observations ──────────────────────────────────────────────────────────────

async function handleObservation(payload: any) {
  const obs = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? obs.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);

  if (jobId) {
    await supabase.from("procore_observations").upsert({
      id:               procoreUuid("obsv", obs.id),
      job_id:           jobId,
      procore_id:       obs.id,
      number:           str(obs.number),
      name:             obs.name ?? null,
      status:           obs.status ?? null,
      priority:         obs.priority ?? null,
      due_date:         d(obs.due_date),
      closed_at:        d(obs.closed_at),
      assignee:         str(obs.assignee),
      trade:            str(obs.trade),
      observation_type: str(obs.type),
    }, { onConflict: "id" });

    await refreshJobCounts(jobId);
  }

  await logActivity("observation", String(obs.id), "procore_observation_sync",
    { status: obs.status, priority: obs.priority, procore_project_id: procoreProjectId }, jobId);
}

// ── Meetings ──────────────────────────────────────────────────────────────────

async function handleMeeting(payload: any) {
  const mtg = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? mtg.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);
  if (!jobId) return;

  const { data: job } = await supabase.from("jobs").select("master_pm_update").eq("id", jobId).maybeSingle();
  const date = mtg.meeting_date ?? new Date().toISOString().slice(0, 10);
  const note = `[${date} Procore Meeting] ${mtg.title ?? "Meeting"} — ${mtg.conclusion ?? mtg.description ?? ""}`.trim();
  await supabase.from("jobs").update({ master_pm_update: [job?.master_pm_update, note].filter(Boolean).join("\n\n") }).eq("id", jobId);
  await logActivity("meeting", String(mtg.id), "procore_meeting_synced",
    { title: mtg.title, date, procore_project_id: procoreProjectId }, jobId);
}

// ── Work Order Contracts (Subcontracts) ───────────────────────────────────────

async function handleWorkOrderContract(payload: any) {
  const woc = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? woc.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);
  if (!jobId) return;

  const patch: any = {};
  if (woc.executed != null)        patch.subcontract_executed = Boolean(woc.executed);
  if (woc.execution_date)          patch.subcontract_date     = d(woc.execution_date);
  if (woc.grand_total != null)     patch.subcontract_amount   = parseFloat(woc.grand_total) || null;

  // Build a human-readable status string for master_subcontract_status
  const parts = [];
  if (woc.number)       parts.push(`#${woc.number}`);
  if (woc.executed)     parts.push("Executed");
  else                  parts.push("Not Executed");
  if (woc.grand_total)  parts.push(`$${Number(woc.grand_total).toLocaleString()}`);
  if (woc.vendor?.name) parts.push(woc.vendor.name);
  patch.master_subcontract_status = parts.join(" · ");

  await supabase.from("jobs").update(patch).eq("id", jobId);
  await logActivity("work_order_contract", String(woc.id), "procore_subcontract_sync",
    { executed: woc.executed, grand_total: woc.grand_total, procore_project_id: procoreProjectId }, jobId);
}

// ── Prime Contract ────────────────────────────────────────────────────────────

async function handlePrimeContract(payload: any) {
  const pc = payload.resource ?? payload;
  const procoreProjectId = payload.project_id ?? pc.project_id;
  const jobId = await findJobId(procoreProjectId, payload.job_number);
  if (!jobId) return;

  const patch: any = {};
  if (pc.executed != null)       patch.prime_contract_executed = Boolean(pc.executed);
  if (pc.execution_date)         patch.prime_contract_date     = d(pc.execution_date);

  // Build human-readable contract string
  const parts = [];
  if (pc.number)             parts.push(`Contract #${pc.number}`);
  if (pc.executed)           parts.push("Executed");
  else                       parts.push("Not Executed");
  if (pc.execution_date)     parts.push(`Signed ${d(pc.execution_date)}`);
  if (pc.grand_total)        parts.push(`$${Number(pc.grand_total).toLocaleString()}`);
  patch.master_contract = parts.join(" · ");

  await supabase.from("jobs").update(patch).eq("id", jobId);
  await logActivity("prime_contract", String(pc.id ?? procoreProjectId), "procore_prime_contract_sync",
    { executed: pc.executed, execution_date: pc.execution_date, procore_project_id: procoreProjectId }, jobId);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-procore-signature, content-type",
      },
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("x-procore-signature") ?? "";
    if (!sig) return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  // Procore sends resource_name + event_type, or legacy type string
  const resourceName: string = (body.resource_name ?? "").toLowerCase().replace(/\s+/g, "_");
  const eventType: string    = (body.event_type ?? body.type ?? "").toLowerCase();
  const trigger              = resourceName || eventType;

  console.log(`Procore webhook: resource=${resourceName} event=${eventType}`);

  try {
    if (trigger.includes("submittal"))               await handleSubmittal(body);
    else if (trigger.includes("daily_log"))          await handleDailyLog(body);
    else if (trigger.includes("rfi"))                await handleRfi(body);
    else if (trigger.includes("punch_item") || trigger.includes("punch_list")) await handlePunchItem(body);
    else if (trigger.includes("change_event"))       await handleChangeEvent(body);
    else if (trigger.includes("checklist") || trigger.includes("inspection")) await handleInspection(body);
    else if (trigger.includes("observation"))        await handleObservation(body);
    else if (trigger.includes("meeting"))            await handleMeeting(body);
    else if (trigger.includes("work_order_contract") || trigger.includes("commitment_contract")) await handleWorkOrderContract(body);
    else if (trigger.includes("prime_contract"))     await handlePrimeContract(body);
    else console.log("Unhandled Procore event:", trigger, body);
  } catch (err: any) {
    console.error("Handler error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, resource: resourceName, event: eventType }), {
    headers: { "Content-Type": "application/json" },
  });
});
