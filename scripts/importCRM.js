/**
 * importCRM.js — One-time import of SCM_Master_CRM.xlsx into Supabase
 *
 * Run: node scripts/importCRM.js
 */

import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXCEL_PATH = "C:/Users/Michael Li/Downloads/SCM_Master_CRM.xlsx";
// Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars before running,
// or paste values here temporarily (do not commit with secrets).
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ixbffxowwvpzzuamvgix.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Excel serial date number OR date string to "YYYY-MM-DD" */
function toDate(val) {
  if (!val && val !== 0) return null;
  if (typeof val === "number") {
    if (val < 1000) return null; // not a date serial
    const info = XLSX.SSF.parse_date_code(val);
    if (!info) return null;
    return `${info.y}-${String(info.m).padStart(2, "0")}-${String(info.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s || s === "None" || s.toLowerCase() === "tbd") return null;
    // M/D/YY or M/D/YYYY
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      let [, mo, d, y] = m;
      if (y.length === 2) y = `20${y}`;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
  return null;
}

function str(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\r?\n/g, " ").trim();
  return s === "" || s === "None" || s === "null" ? null : s;
}

function num(val) {
  const n = parseFloat(String(val ?? "").replace(/[$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function prob(val) {
  if (val === null || val === undefined || val === "") return 50;
  const n = parseFloat(val);
  if (isNaN(n)) return 50;
  return n <= 1 ? Math.round(n * 100) : Math.min(100, Math.round(n));
}

/** Normalize job # — strips trailing ".0" from Excel float representation */
function jobNum(val) {
  if (!val && val !== 0) return null;
  const s = String(val).trim().replace(/\.0+$/, "");
  return s === "" || s === "None" ? null : s;
}

/** Only keep PM values that look like a person's name, not a number */
function cleanPm(val) {
  if (!val) return null;
  // Reject if it's purely numeric (dollar amounts leaking from adjacent column)
  if (/^[\d.,\s$]+$/.test(val)) return null;
  // Reject known non-name values
  if (/^(tbd|n\/a|none|need pm)$/i.test(val.trim())) return null;
  return val;
}

function mapLine(val) {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/(\d)/);
  // "Shipped" or "Yard" etc. → no line assignment
  if (!m) return null;
  return `L${m[1]}`;
}

// DB CHECK: 'forecast','approved','hold','production','delayed','complete'
function mapProductionStatus(stage) {
  if (!stage) return "forecast";
  const s = String(stage).toLowerCase();
  if (s.includes("ship") || s.includes("set")) return "complete";
  if (s.includes("on line") || s.includes("upcoming") || s.includes("yard")) return "production";
  if (s.includes("approved") || s.includes("active") || s.includes("kickoff") || s.includes("handoff")) return "approved";
  if (s.includes("hold")) return "hold";
  if (s.includes("delayed")) return "delayed";
  if (s.includes("closed")) return "complete";
  return "forecast";
}

function mapPipelineStage(stage) {
  if (!stage) return "lead";
  const s = String(stage).toLowerCase();
  if (s.includes("active")) return "proposal";
  if (s.includes("closed")) return "handoff";
  if (s.includes("lead") || s.includes("pre-con")) return "lead";
  if (s.includes("award")) return "award";
  // "Lost*" → return null to skip
  if (s.includes("lost")) return null;
  return "lead";
}

function jobColor(status) {
  return {
    complete:    "#10b981",
    production:  "#F97316",
    approved:    "#3b82f6",
    hold:        "#ef4444",
    delayed:     "#f59e0b",
  }[status] ?? "#94a3b8";
}

/** Read sheet, skip title row (row 0), use row 1 as headers */
function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) { console.warn(`  ⚠ Sheet "${name}" not found`); return []; }
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (raw.length < 2) return [];
  const headers = raw[1].map((h) => str(h) || "");
  const rows = [];
  for (let i = 2; i < raw.length; i++) {
    const arr = raw[i];
    if (!arr || arr.every((c) => c === null || c === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => { if (h) obj[h] = arr[idx] ?? null; });
    rows.push(obj);
  }
  return rows;
}

async function upsertBatch(table, rows, conflict = "id", batchSize = 150) {
  if (!rows.length) { console.log(`  ↩ ${table}: 0 rows — skipped`); return; }
  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflict });
    if (error) {
      console.error(`  ✗ ${table} batch @${i}:`, error.message);
      // Log first failing row for debugging
      console.error("    First row:", JSON.stringify(batch[0]).slice(0, 200));
      fail += batch.length;
    } else {
      ok += batch.length;
    }
  }
  console.log(`  ✓ ${table}: ${ok} upserted${fail ? `, ${fail} failed` : ""}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📂  Reading:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH, { raw: true });
  console.log("    Sheets:", wb.SheetNames.join(", "), "\n");

  const masterRows     = readSheet(wb, "Master Jobs");
  const pipelineRows   = readSheet(wb, "Sales Pipeline");
  const productionRows = readSheet(wb, "Active Production");

  console.log(`Raw row counts → Master: ${masterRows.length}, Pipeline: ${pipelineRows.length}, Production: ${productionRows.length}\n`);

  // ── Step 1: Clients ────────────────────────────────────────────────────────

  console.log("── Step 1: Clients ──");
  const clientNames = new Set();
  for (const r of [...masterRows, ...pipelineRows]) {
    const n = str(r["Customer / District"]);
    if (n) clientNames.add(n);
  }
  console.log(`  Found ${clientNames.size} unique clients`);

  // Fetch existing
  const { data: existingClients = [], error: fetchErr } = await supabase
    .from("clients").select("id, name");
  if (fetchErr) { console.error("  ✗ fetch clients:", fetchErr.message); return; }

  const clientMap = new Map(existingClients.map((c) => [c.name, c.id]));
  const newClientRows = [...clientNames]
    .filter((n) => !clientMap.has(n))
    .map((n) => ({ name: n }));

  if (newClientRows.length) {
    const { data: inserted, error } = await supabase
      .from("clients").insert(newClientRows).select("id, name");
    if (error) { console.error("  ✗ insert clients:", error.message); }
    else { (inserted || []).forEach((c) => clientMap.set(c.name, c.id)); }
  }
  console.log(`  ✓ clients ready: ${clientMap.size} total (${newClientRows.length} new)\n`);

  // ── Step 2: Sales Pipeline → sales_pipeline_deals ─────────────────────────

  console.log("── Step 2: Sales Pipeline Deals ──");
  const dealRows = [];
  const dealSeenIds = new Set();

  for (let idx = 0; idx < pipelineRows.length; idx++) {
    const r = pipelineRows[idx];
    const rawStage = str(r["Pipeline Stage"]);
    const dbStage  = mapPipelineStage(rawStage);
    if (!dbStage) continue; // skip Lost

    const projName = str(r["Project Name"]);
    if (!projName) continue;

    const jn         = jobNum(r["Job #"]);
    const clientName = str(r["Customer / District"]);
    const amountVal  = num(r["Contract Value ($)"]);
    const probVal    = prob(r["Confidence"]);

    // Build a stable id: prefer job# prefix, fall back to slug
    const slug = projName.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30);
    const id = jn ? `deal-${jn}` : `deal-${slug}-${idx}`;

    if (dealSeenIds.has(id)) continue;
    dealSeenIds.add(id);

    dealRows.push({
      id,
      opportunity_name:    projName,
      client:              clientName,
      client_id:           clientName ? (clientMap.get(clientName) ?? null) : null,
      stage:               dbStage,
      probability:         probVal,
      amount:              amountVal,
      weighted_amount:     Math.round(amountVal * (probVal / 100)),
      expected_close_date: toDate(r["District Occupancy Date"]) || toDate(r["Prod Start Date"]),
      bdm:                 str(r["BDM"]),
      project_manager:     str(r["PM"]),
      notes:               str(r["Current Status / Notes"]),
      source_type:         "excel_import",
      source_sheet:        "Sales Pipeline",
      source_row:          idx + 2, // +2 for 2-row header
    });
  }

  console.log(`  Parsed ${dealRows.length} deals`);
  await upsertBatch("sales_pipeline_deals", dealRows, "id");
  console.log();

  // ── Step 3: Master Jobs → jobs ────────────────────────────────────────────

  console.log("── Step 3: Jobs (Master Jobs) ──");

  // Index Active Production rows by job# for submittal/DSA enrichment
  const apByJobNum = new Map();
  for (const r of productionRows) {
    const jn = jobNum(r["Job #"]);
    if (!jn) continue;
    if (!apByJobNum.has(jn)) apByJobNum.set(jn, []);
    apByJobNum.get(jn).push(r);
  }

  const jobDbRows = [];
  const seenJobIds = new Set();

  for (let idx = 0; idx < masterRows.length; idx++) {
    const r = masterRows[idx];
    const projName = str(r["Project Name"]);
    if (!projName) continue;

    const jn         = jobNum(r["Job #"]);
    const clientName = str(r["Customer / District"]);
    const status     = mapProductionStatus(r["Production Stage"]);
    const lineRaw    = str(r["Production Line"]);
    const startDate  = toDate(r["Prod Start Date"]);
    const topDate    = toDate(r["Topset Date"]);
    const shipDate   = toDate(r["Shipping Date"]);
    const setDate    = toDate(r["Set Date"]);
    const dueDate    = toDate(r["District Occupancy Date"]);

    // Each building row gets a unique job id: "crm-{jobnum}-{1-based-row}"
    const jobId = `crm-${jn ?? "unk"}-${idx + 1}`;
    if (seenJobIds.has(jobId)) continue;
    seenJobIds.add(jobId);

    // Best matching Active Production row for this building
    const apList = jn ? (apByJobNum.get(jn) || []) : [];
    const ap = apList.find((a) => {
      const apName = str(a["Project Name"]) || "";
      return apName.replace(/\s+/g, " ").trim() === projName.replace(/\s+/g, " ").trim();
    }) || apList[0] || {};

    // Skip rows that look like section headers or blank/junk (no job# AND no client AND name looks like a person)
    if (!jn && !clientName && projName.split(/\s+/).length <= 2) continue;
    // Need at least one date to anchor the job on the Gantt
    const anyDate = startDate || topDate || shipDate || setDate;
    if (!anyDate) continue; // old archived jobs with no dates — skip

    const effectiveStart = startDate || topDate || shipDate || "2025-01-01";
    const effectiveEnd   = shipDate || setDate || startDate || topDate || effectiveStart;

    const contractVal = num(r["Contract Value ($)"]);
    const probVal     = prob(r["Confidence Level"]);

    jobDbRows.push({
      id:           jobId,
      job_number:   jn,
      name:         projName,
      client:       clientName,
      client_id:    clientName ? (clientMap.get(clientName) ?? null) : null,
      line_id:      mapLine(lineRaw),
      start_date:   effectiveStart,
      end_date:     effectiveEnd,
      due_date:     dueDate,
      off_line_date: topDate,
      status,
      priority:     "Medium",
      progress:     status === "complete" ? 100
                  : status === "production" ? 50 : 0,
      color:        jobColor(status),
      notes:        str(r["Current Status / Notes"]),

      // Finance
      source_deal_id: jn ? (`deal-${jn}` in dealSeenIds ? `deal-${jn}` : null) : null,

      // Master/submittal fields
      master_contract:            str(r["Contract Status"])            || str(ap["Contract Status"]),
      master_submittals_out:      toDate(ap["Submittals Out"]),
      master_submittals_received: toDate(ap["Submittals Received"]),
      master_dsa_status:          str(r["DSA Status"])                 || str(ap["DSA Status"]),
      master_dsa_redlines:        toDate(r["DSA Redlines"])            || toDate(ap["DSA Redlines"]),
      master_dsa_approval:        toDate(r["Est. DSA Approval Date"])  || toDate(ap["Est. DSA Approval"]),
      master_inspector:           str(r["Inspector"])                  || str(ap["Inspector"]),
      master_lab:                 str(r["Lab"])                        || str(ap["Lab"]),
      master_job_card:            str(r["Job Card"])                   || str(ap["Job Card"]),
      master_subcontract_status:  str(r["Factory Sub Status"])         || str(ap["Factory Sub Status"]),
      master_open_items:          str(r["Open Items"])                 || str(ap["Open Items"]),
      master_pm_update:           str(r["PM Update"])                  || str(ap["PM Update"]),

      pm:           cleanPm(str(r["PM"]) || str(ap["PM"])),

      source_type:  "excel_import",
      source_sheet: "Master Jobs",
      source_row:   idx + 2,
    });
  }

  console.log(`  Parsed ${jobDbRows.length} job rows`);
  await upsertBatch("jobs", jobDbRows, "id");
  console.log();

  // ── Step 4: Link deals → jobs ──────────────────────────────────────────────

  console.log("── Step 4: Linking deals → jobs ──");
  const jobIdsByJobNum = new Map();
  for (const j of jobDbRows) {
    if (j.job_number) {
      if (!jobIdsByJobNum.has(j.job_number)) jobIdsByJobNum.set(j.job_number, []);
      jobIdsByJobNum.get(j.job_number).push(j.id);
    }
  }

  let linked = 0;
  for (const d of dealRows) {
    // deal id is "deal-{jobnum}"
    const jn = d.id.startsWith("deal-") ? d.id.replace("deal-", "").split("-")[0] : null;
    if (!jn) continue;
    const matchedIds = jobIdsByJobNum.get(jn);
    if (!matchedIds?.length) continue;
    const { error } = await supabase
      .from("sales_pipeline_deals")
      .update({ converted_job_id_fk: matchedIds[0] })
      .eq("id", d.id);
    if (!error) linked++;
  }
  console.log(`  ✓ Linked ${linked} deals to their first job row\n`);

  // ── Step 5: Activity log entry ─────────────────────────────────────────────

  await supabase.from("activity_log").insert({
    entity_type: "system",
    entity_id:   "excel_import",
    action:      "crm_excel_imported",
    detail: {
      file:    "SCM_Master_CRM.xlsx",
      clients: clientMap.size,
      deals:   dealRows.length,
      jobs:    jobDbRows.length,
      ts:      new Date().toISOString(),
    },
    user_name: "Michael Li",
  });

  console.log("✅  Import complete!");
  console.log(`     Clients : ${clientMap.size}`);
  console.log(`     Deals   : ${dealRows.length}`);
  console.log(`     Jobs    : ${jobDbRows.length}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
