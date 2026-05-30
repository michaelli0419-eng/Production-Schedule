/**
 * Procore Sync — Supabase Edge Function
 *
 * On-demand pull from Procore REST API for a single project.
 * Fetches all existing RFIs, submittals, punch items, change events,
 * inspections, and observations and upserts them into SCM Hub tables.
 *
 * POST /functions/v1/procore-sync
 * Body: { "job_number": "11671" }   OR   { "procore_project_id": 562949955245294 }
 *
 * Deploy:
 *   npx supabase functions deploy procore-sync --project-ref ixbffxowwvpzzuamvgix --no-verify-jwt
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PROCORE_BASE   = "https://api.procore.com";
const CLIENT_ID      = Deno.env.get("PROCORE_CLIENT_ID")!;
const CLIENT_SECRET  = Deno.env.get("PROCORE_CLIENT_SECRET")!;
const SCM_COMPANY_ID = 562949953440765; // Silver Creek Modular

// ── OAuth token (client credentials) ─────────────────────────────────────────

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch("https://login.procore.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Procore OAuth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token!;
}

// ── Procore API fetch helper ───────────────────────────────────────────────────

async function pget(path: string, companyId: number, params: Record<string, any> = {}): Promise<any[]> {
  const token = await getToken();
  const url = new URL(`${PROCORE_BASE}${path}`);
  url.searchParams.set("per_page", "10000");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Procore-Company-Id": String(companyId),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Procore GET ${path} failed: ${res.status} ${err}`);
    return [];
  }

  const data = await res.json();
  // Some endpoints wrap in { data: [...] }
  return Array.isArray(data) ? data : (data.data ?? []);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function d(val: any): string | null {
  return val ? String(val).slice(0, 10) : null;
}
function str(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "object") return val.name ?? val.label ?? val.login_information?.email ?? JSON.stringify(val);
  return String(val);
}
function procoreUuid(prefix: string, id: number): string {
  const hex = id.toString(16).padStart(12, "0");
  const pfx = [...prefix.slice(0, 4)].map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("").slice(0, 8).padEnd(8, "0");
  return `${pfx}-7072-4f63-${hex.slice(0, 4)}-${hex}`;
}

// ── Find company ID ───────────────────────────────────────────────────────────

async function getCompanyId(): Promise<number> {
  const token = await getToken();
  const res = await fetch(`${PROCORE_BASE}/rest/v1.0/companies`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not fetch companies: ${res.status}`);
  const companies = await res.json();
  if (!companies.length) throw new Error("No companies found for this Procore app");
  return companies[0].id;
}

// ── Find Procore project by job number ────────────────────────────────────────

async function findProcoreProject(companyId: number, jobNumber: string, procoreProjectId?: number): Promise<{ id: number; name: string } | null> {
  const token = await getToken();

  // Direct by ID
  if (procoreProjectId) {
    const res = await fetch(`${PROCORE_BASE}/rest/v1.0/projects/${procoreProjectId}`, {
      headers: { Authorization: `Bearer ${token}`, "Procore-Company-Id": String(companyId) },
    });
    if (res.ok) return res.json();
  }

  // Search by project number
  const url = new URL(`${PROCORE_BASE}/rest/v1.0/projects`);
  url.searchParams.set("company_id", String(companyId));
  url.searchParams.set("filters[project_number]", jobNumber);
  url.searchParams.set("per_page", "10");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, "Procore-Company-Id": String(companyId) },
  });
  if (!res.ok) return null;
  const projects = await res.json();
  // Procore field is project_number (not number) — also handle "11279 Grandview ES" format
  return projects.find((p: any) =>
    String(p.project_number ?? "").startsWith(jobNumber)
  ) ?? projects[0] ?? null;
}

// ── Sync each resource type ───────────────────────────────────────────────────

async function syncSubmittals(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/projects/${projectId}/submittals`, companyId);
  if (!items.length) return 0;

  const statusMap: Record<string, string> = {
    draft: "not_sent", submitted: "sent", under_review: "under_review",
    approved: "approved", approved_as_noted: "approved",
    revise_and_resubmit: "resubmit_required", rejected: "rejected",
  };
  const dsaMap: Record<string, string> = {
    approved: "Approved", approved_as_noted: "Approved as Noted",
    revise_and_resubmit: "Revise & Resubmit", rejected: "Rejected",
    under_review: "Under Review", draft: "Draft", submitted: "Submitted",
  };

  const rows = items.map((s: any) => ({
    id:            procoreUuid("subm", s.id),
    job_id:        jobId,
    type:          "submittal",
    title:         s.title ?? s.spec_section?.description ?? "Procore Submittal",
    rev_number:    s.revision ?? 1,
    status:        statusMap[str(s.status)?.toLowerCase() ?? ""] ?? "not_sent",
    sent_date:     d(s.submitted_at),
    received_date: d(s.received_at),
    approved_date: d(s.approved_at),
    reviewer:      str(s.responsible_contractor),
    notes:         s.description ?? null,
  }));

  const { error } = await supabase.from("submittals").upsert(rows, { onConflict: "id" });
  if (error) console.error("submittals upsert:", error.message);

  // Update job DSA fields from most recent approved/active submittal
  const latest = items.reduce((a: any, b: any) =>
    new Date(a.updated_at ?? 0) > new Date(b.updated_at ?? 0) ? a : b, items[0]);
  const patch: any = {};
  if (latest.submitted_at) patch.master_submittals_out      = d(latest.submitted_at);
  if (latest.received_at)  patch.master_submittals_received = d(latest.received_at);
  if (latest.status)       patch.master_dsa_status          = dsaMap[str(latest.status)?.toLowerCase() ?? ""] ?? str(latest.status);
  if (latest.approved_at)  patch.master_dsa_approval        = d(latest.approved_at);
  if (Object.keys(patch).length) await supabase.from("jobs").update(patch).eq("id", jobId);

  return rows.length;
}

async function syncRfis(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/projects/${projectId}/rfis`, companyId);
  if (!items.length) return 0;

  const rows = items.map((r: any) => ({
    id:            procoreUuid("rfi_", r.id),
    job_id:        jobId,
    procore_id:    r.id,
    number:        str(r.number),
    title:         r.subject ?? r.title ?? null,
    status:        r.status ?? null,
    priority:      r.priority ?? null,
    question:      r.question ?? null,
    answer:        r.answer ?? null,
    due_date:      d(r.due_date),
    closed_at:     d(r.closed_at),
    ball_in_court: str(r.ball_in_court),
    spec_section:  str(r.spec_section),
    assignee:      str(r.assignee),
  }));

  const { error } = await supabase.from("procore_rfis").upsert(rows, { onConflict: "id" });
  if (error) console.error("rfis upsert:", error.message);
  return rows.length;
}

async function syncPunchItems(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/punch_items`, companyId, { project_id: projectId });
  if (!items.length) return 0;

  const rows = items.map((p: any) => ({
    id:                   procoreUuid("pnch", p.id),
    job_id:               jobId,
    procore_id:           p.id,
    name:                 p.name ?? null,
    status:               p.status ?? null,
    priority:             p.priority ?? null,
    due_date:             d(p.due_date),
    closed_at:            d(p.closed_at),
    schedule_impact:      p.schedule_impact ?? null,
    schedule_impact_days: p.schedule_impact_days ?? 0,
    cost_impact:          p.cost_impact ?? null,
    cost_impact_amount:   p.cost_impact_amount ?? 0,
    assignee:             str(p.punch_item_manager ?? p.final_approver),
    trade:                str(p.trade),
    location:             str(p.location),
  }));

  const { error } = await supabase.from("procore_punch_items").upsert(rows, { onConflict: "id" });
  if (error) console.error("punch_items upsert:", error.message);
  return rows.length;
}

async function syncChangeEvents(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/change_events`, companyId, { project_id: projectId });
  if (!items.length) return 0;

  const rows = items.map((c: any) => ({
    id:            procoreUuid("chev", c.id),
    job_id:        jobId,
    procore_id:    c.id,
    number:        str(c.alphanumeric_number ?? c.number),
    title:         c.title ?? null,
    status:        str(c.status),
    scope:         c.event_scope ?? null,
    change_type:   str(c.event_type),
    change_reason: str(c.change_order_change_reason),
    description:   c.description ?? null,
  }));

  const { error } = await supabase.from("procore_change_events").upsert(rows, { onConflict: "id" });
  if (error) console.error("change_events upsert:", error.message);
  return rows.length;
}

async function syncInspections(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/checklist/lists`, companyId, { project_id: projectId });
  if (!items.length) return 0;

  const rows = items.map((i: any) => ({
    id:                     procoreUuid("insp", i.id),
    job_id:                 jobId,
    procore_id:             i.id,
    name:                   i.name ?? null,
    status:                 i.status ?? null,
    inspection_date:        d(i.inspection_date),
    due_at:                 d(i.due_at),
    inspector:              str(i.inspectors?.[0] ?? i.created_by),
    responsible_contractor: str(i.responsible_contractor),
    conforming_count:       i.conforming_item_count ?? i.yes_item_count ?? 0,
    deficient_count:        i.deficient_item_count ?? 0,
    total_items:            i.item_count ?? i.item_total ?? 0,
  }));

  const { error } = await supabase.from("procore_inspections").upsert(rows, { onConflict: "id" });
  if (error) console.error("inspections upsert:", error.message);

  const totalDeficient = rows.reduce((s, r) => s + (r.deficient_count ?? 0), 0);
  if (totalDeficient > 0) await supabase.from("jobs").update({ readiness_inspections: false }).eq("id", jobId);
  return rows.length;
}

async function syncObservations(companyId: number, projectId: number, jobId: string): Promise<number> {
  const items = await pget(`/rest/v1.0/observations/items`, companyId, { project_id: projectId });
  if (!items.length) return 0;

  const rows = items.map((o: any) => ({
    id:               procoreUuid("obsv", o.id),
    job_id:           jobId,
    procore_id:       o.id,
    number:           str(o.number),
    name:             o.name ?? null,
    status:           o.status ?? null,
    priority:         o.priority ?? null,
    due_date:         d(o.due_date),
    closed_at:        d(o.closed_at),
    assignee:         str(o.assignee),
    trade:            str(o.trade),
    observation_type: str(o.type),
  }));

  const { error } = await supabase.from("procore_observations").upsert(rows, { onConflict: "id" });
  if (error) console.error("observations upsert:", error.message);
  return rows.length;
}

async function refreshJobCounts(jobId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const [rfis, punches, ces, obs, insps] = await Promise.all([
    supabase.from("procore_rfis").select("status, due_date").eq("job_id", jobId),
    supabase.from("procore_punch_items").select("status, schedule_impact_days").eq("job_id", jobId),
    supabase.from("procore_change_events").select("status").eq("job_id", jobId),
    supabase.from("procore_observations").select("status").eq("job_id", jobId),
    supabase.from("procore_inspections").select("deficient_count").eq("job_id", jobId),
  ]);

  await supabase.from("jobs").update({
    rfi_open_count:              (rfis.data ?? []).filter((r: any) => r.status !== "closed").length,
    rfi_overdue_count:           (rfis.data ?? []).filter((r: any) => r.status !== "closed" && r.due_date && r.due_date < today).length,
    punch_open_count:            (punches.data ?? []).filter((p: any) => p.status === "open" || p.status === "ready_for_review").length,
    punch_schedule_impact_days:  (punches.data ?? []).reduce((s: number, p: any) => s + (p.schedule_impact_days ?? 0), 0),
    change_event_count:          (ces.data ?? []).filter((c: any) => c.status !== "void" && c.status !== "closed").length,
    observation_open_count:      (obs.data ?? []).filter((o: any) => o.status !== "closed").length,
    inspection_deficient_count:  (insps.data ?? []).reduce((s: number, i: any) => s + (i.deficient_count ?? 0), 0),
  }).eq("id", jobId);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const jobNumber: string   = body.job_number ? String(body.job_number) : "";
  const explicitProcoreId   = body.procore_project_id ? Number(body.procore_project_id) : undefined;

  if (!jobNumber && !explicitProcoreId) {
    return new Response(JSON.stringify({ error: "Provide job_number or procore_project_id" }), { status: 400 });
  }

  try {
    const writeProcoreLog = async (entry: any) => {
      try {
        await supabase.from("procore_sync_log").insert(entry);
      } catch (_err) {
        // Keep sync resilient even if logging table write fails
      }
    };

    // 1. Find our SCM job
    const scmQuery = jobNumber
      ? supabase.from("jobs").select("id, procore_project_id").eq("job_number", jobNumber).maybeSingle()
      : supabase.from("jobs").select("id, procore_project_id").eq("procore_project_id", explicitProcoreId!).maybeSingle();
    const { data: scmJob } = await scmQuery;
    if (!scmJob) {
      await writeProcoreLog({
        direction: "inbound",
        operation: "pull_project",
        status: "failed",
        error_message: `No SCM job found for job_number=${jobNumber}`,
      });
      return new Response(JSON.stringify({ error: `No SCM job found for job_number=${jobNumber}` }), { status: 404 });
    }

    // 2. Find Procore project (company ID is hardcoded — Silver Creek Modular)
    const companyId = SCM_COMPANY_ID;
    const project   = await findProcoreProject(companyId, jobNumber, explicitProcoreId ?? scmJob.procore_project_id ?? undefined);
    if (!project) {
      await writeProcoreLog({
        direction: "inbound",
        operation: "pull_project",
        status: "failed",
        job_id: scmJob.id,
        error_message: `No Procore project found for project number ${jobNumber}`,
      });
      return new Response(JSON.stringify({ error: `No Procore project found for project number ${jobNumber}` }), { status: 404 });
    }

    console.log(`Syncing Procore project ${project.id} (${project.name}) → SCM job ${scmJob.id}`);

    // Store procore_project_id on job for future webhook matching
    if (!scmJob.procore_project_id) {
      await supabase.from("jobs").update({ procore_project_id: project.id }).eq("id", scmJob.id);
    }

    // 3. Sync all resource types in parallel
    const [submittals, rfis, punches, changeEvents, inspections, observations] = await Promise.all([
      syncSubmittals(companyId, project.id, scmJob.id),
      syncRfis(companyId, project.id, scmJob.id),
      syncPunchItems(companyId, project.id, scmJob.id),
      syncChangeEvents(companyId, project.id, scmJob.id),
      syncInspections(companyId, project.id, scmJob.id),
      syncObservations(companyId, project.id, scmJob.id),
    ]);

    // 4. Refresh live counters on jobs row
    await refreshJobCounts(scmJob.id);

    await writeProcoreLog({
      direction: "inbound",
      operation: "pull_project",
      status: "success",
      job_id: scmJob.id,
      external_id: String(project.id),
      payload: { submittals, rfis, punches, changeEvents, inspections, observations },
    });

    // 5. Log activity
    await supabase.from("activity_log").insert({
      entity_type: "job",
      entity_id:   scmJob.id,
      action:      "procore_manual_sync",
      detail:      { project_id: project.id, project_name: project.name, submittals, rfis, punches, changeEvents, inspections, observations },
      user_name:   "Manual Sync",
    });

    return new Response(JSON.stringify({
      ok: true,
      procore_project: { id: project.id, name: project.name },
      synced: { submittals, rfis, punches, changeEvents, inspections, observations },
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("Sync error:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
