import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "../hooks/useJobs.js";
import { usePipelineDeals } from "../hooks/usePipelineDeals.js";
import { useSubmittals } from "../hooks/useSubmittals.js";
import { useUserProfiles } from "../hooks/useUserProfiles.js";
import { registerAction, clearActions } from "../lib/schedulerActions.js";
import { isSupabaseEnabled, supabase as supabaseClient } from "../lib/supabase.js";
import { logActivity } from "../lib/activityApi.js";
import PipelineKanban from "./PipelineKanban.jsx";

const FALLBACK_YEAR = 2026;
const LINES = [
  { id: "L1", name: "Line 1", focus: "Pods + classrooms" },
  { id: "L2", name: "Line 2", focus: "Classroom wings" },
  { id: "L3", name: "Line 3", focus: "Admin + specialty" },
  { id: "L4", name: "Line 4", focus: "Final assembly" },
];
const LINE_IDS = LINES.map((line) => line.id);
const QUEUE = "QUEUE";
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", title: "Company Dashboard", description: "A command view for backlog, line capacity, sales handoffs, risks, and current operational priorities." },
  { id: "production", label: "Production", title: "Production Schedule", description: "Factory line scheduling, date control, readiness, conflicts, and queued production work." },
  { id: "capacity", label: "Capacity Planner", title: "Capacity Planner", description: "Forward-looking line load vs. capacity by month, with pipeline probability weighting for demand forecasting." },
  { id: "submittals", label: "Submittals", title: "Submittal & Approval Tracker", description: "Track all pending submittals, DSA approvals, inspector assignments, and aging documents across active jobs." },
  { id: "pipeline", label: "Sales Pipeline", title: "Sales Pipeline", description: "Track opportunities from lead through award before they become scheduled production jobs." },
  { id: "projects", label: "Active Production", title: "Active Production", description: "Daily standup view — inline-editable status, dates, DSA, submittals, open items, and PM updates for every active job." },
  { id: "reports", label: "Reports", title: "Reports", description: "Reusable operating reports for leadership, sales, production, and project teams." },
  { id: "settings", label: "Settings", title: "Settings", description: "Configure lines, statuses, users, integrations, and field mappings." },
];
const SCHEDULE_VIEWS = [
  { id: "production", label: "Production", endKey: "offLine", endLabel: "Topset Complete" },
  { id: "shipping", label: "Shipping", endKey: "end", endLabel: "Shipping" },
  { id: "set", label: "Set", endKey: "due", endLabel: "Set" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 86400000;
const HEADER_H = 72;   // increased to fit month + week row
const ROW_H = 76;
const MIN_DRAW_PX = 10;
const EXCEL_API_URL = "http://127.0.0.1:5174";

async function readExcelApiJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Start Excel sync server with npm run dev:excel");
  }
  return res.json();
}
const STATUS_CONFIG = {
  forecast:   { label: "Forecast",   color: "#64748b", bg: "#f1f5f9" },
  approved:   { label: "Approved",   color: "#2563eb", bg: "#dbeafe" },
  hold:       { label: "Hold",       color: "#b45309", bg: "#fef3c7" },
  production: { label: "Production", color: "#047857", bg: "#d1fae5" },
  delayed:    { label: "Delayed",    color: "#b91c1c", bg: "#fee2e2" },
  complete:   { label: "Complete",   color: "#6d28d9", bg: "#ede9fe" },
};
const JOB_COLORS = [
  "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#db2777", "#0891b2", "#65a30d",
  "#ea580c", "#4f46e5", "#0f766e", "#be123c",
];
const SAMPLE_JOBS = [
  {
    id: "1",
    name: "LAUSD Classroom Village",
    client: "Los Angeles USD",
    line: "L1",
    start: "2026-01-05",
    offLine: "2026-02-04",
    end: "2026-02-18",
    due: "2026-02-28",
    color: "#2563eb",
    status: "production",
    modules: 28,
    crew: 18,
    priority: "High",
    progress: 58,
    readiness: { drawings: true, materials: true, permits: true, inspections: false },
    notes: "Main production run. Inspection slot is still being coordinated.",
  },
  {
    id: "2",
    name: "San Diego Charter Phase 2",
    client: "SD Charter Group",
    line: "L2",
    start: "2026-02-02",
    offLine: "2026-03-04",
    end: "2026-03-06",
    due: "2026-03-15",
    color: "#059669",
    status: "hold",
    modules: 18,
    crew: 14,
    priority: "Medium",
    progress: 12,
    readiness: { drawings: true, materials: false, permits: true, inspections: false },
    notes: "Waiting on switchgear and long-lead HVAC confirmation.",
  },
  {
    id: "3",
    name: "Riverside Science Wing",
    client: "Riverside Unified",
    line: "L3",
    start: "2026-03-11",
    offLine: "2026-04-10",
    end: "2026-04-24",
    due: "2026-05-02",
    color: "#d97706",
    status: "approved",
    modules: 22,
    crew: 16,
    priority: "Medium",
    progress: 0,
    readiness: { drawings: true, materials: true, permits: false, inspections: false },
    notes: "Permit resubmittal expected before production start.",
  },
  {
    id: "4",
    name: "Fresno TK Expansion",
    client: "Fresno USD",
    line: "L4",
    start: "2026-05-04",
    offLine: "2026-06-03",
    end: "2026-06-30",
    due: "2026-06-26",
    color: "#dc2626",
    status: "delayed",
    modules: 32,
    crew: 20,
    priority: "Critical",
    progress: 20,
    readiness: { drawings: true, materials: true, permits: true, inspections: true },
    notes: "Schedule is beyond requested ship date. Needs recovery plan.",
  },
  {
    id: "5",
    name: "Oakland Cafeteria Pods",
    client: "Oakland USD",
    line: QUEUE,
    start: "2026-07-06",
    offLine: "2026-08-05",
    end: "2026-07-31",
    due: "2026-08-07",
    color: "#7c3aed",
    status: "forecast",
    modules: 10,
    crew: 8,
    priority: "Low",
    progress: 0,
    readiness: { drawings: false, materials: false, permits: false, inspections: false },
    notes: "Not yet assigned to a line.",
  },
];
let nextId = 1000;

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function toDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function defaultTopsetCompleteDate(start) {
  return start ? addDays(start, 30) : "2026-01-31";
}

function dateDiffDays(start, end) {
  return Math.max(1, Math.round((toDate(end) - toDate(start)) / MS_PER_DAY) + 1);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || aStart > bEnd);
}

function jobLabel(job) {
  return job?.jobNumber ? `${job.jobNumber} · ${job.name}` : (job?.name || "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function diffDays(start, end) {
  return Math.round((end - start) / MS_PER_DAY);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const number = Number.parseInt(value, 16);

  if (Number.isNaN(number)) return { r: 37, g: 99, b: 235 };

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function mixRgb(a, b, weight) {
  return {
    r: Math.round(a.r + (b.r - a.r) * weight),
    g: Math.round(a.g + (b.g - a.g) * weight),
    b: Math.round(a.b + (b.b - a.b) * weight),
  };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function getColorShades(color) {
  const base = hexToRgb(color);
  return {
    dark: rgbToCss(mixRgb(base, { r: 15, g: 23, b: 42 }, 0.2)),
    base: rgbToCss(base),
    light: rgbToCss(mixRgb(base, { r: 255, g: 255, b: 255 }, 0.24)),
  };
}

function percentBetween(start, end, value) {
  const span = Math.max(1, diffDays(toDate(start), toDate(end)));
  const offset = clamp(diffDays(toDate(start), toDate(value)), 0, span);
  return (offset / span) * 100;
}

function getMilestoneDates(job) {
  const topsetComplete = job.offLine || defaultTopsetCompleteDate(job.start);
  return {
    start: job.start,
    offLine: topsetComplete,
    end: job.end,
    due: job.due,
  };
}

function latestDate(...dates) {
  return dates.reduce((latest, date) => date > latest ? date : latest, dates[0]);
}

function getTrackRange(job, scheduleView) {
  const dates = getMilestoneDates(job);
  return {
    start: dates.start,
    end: scheduleView === "production"
      ? dates.offLine
      : latestDate(dates.offLine, dates.end, dates.due),
  };
}

function getScheduleEnd(job, scheduleView) {
  const dates = getMilestoneDates(job);
  const view = SCHEDULE_VIEWS.find((item) => item.id === scheduleView) || SCHEDULE_VIEWS[0];
  return dates[view.endKey] || dates.offLine;
}

function getMilestoneLayout(job, scheduleView) {
  const dates = getMilestoneDates(job);
  const trackRange = getTrackRange(job, scheduleView);
  const scheduleEnd = getScheduleEnd(job, scheduleView);
  const view = SCHEDULE_VIEWS.find((item) => item.id === scheduleView) || SCHEDULE_VIEWS[0];
  const schedulePct = percentBetween(trackRange.start, trackRange.end, scheduleEnd);
  const shades = getColorShades(job.color);
  return {
    dates,
    trackRange,
    view,
    schedulePct,
    offLinePct: percentBetween(trackRange.start, trackRange.end, dates.offLine),
    shipPct: percentBetween(trackRange.start, trackRange.end, dates.end),
    setPct: percentBetween(trackRange.start, trackRange.end, dates.due),
    coreBackground: `linear-gradient(90deg, ${shades.dark}, ${shades.base})`,
    shippingShade: rgbToCss(mixRgb(hexToRgb(job.color), { r: 255, g: 255, b: 255 }, 0.34)),
    setShade: rgbToCss(mixRgb(hexToRgb(job.color), { r: 255, g: 255, b: 255 }, 0.58)),
  };
}

function normalizeJob(job, index) {
  const fallbackStart =
    job.start ||
    job.start_date ||
    job.end ||
    job.end_date ||
    job.due ||
    job.due_date ||
    "2026-01-05";
  const fallbackEnd =
    job.end ||
    job.end_date ||
    job.due ||
    job.due_date ||
    fallbackStart;
  const fallbackDue =
    job.due ||
    job.due_date ||
    fallbackEnd;

  return {
    id: job.id || String(Date.now() + index),
    name: job.name || job.job_name || "New School Project",
    client: job.client || "District",
    line: LINE_IDS.includes(job.line) || job.line === QUEUE ? job.line : "L1",
    start: fallbackStart,
    end: fallbackEnd,
    due: fallbackDue,
    offLine: job.offLine || job.topsetComplete || job.topset_complete || job.off_line || defaultTopsetCompleteDate(
      job.start || job.start_date || "2026-01-05",
    ),
    color: job.color || JOB_COLORS[index % JOB_COLORS.length],
    status: STATUS_CONFIG[job.status] ? job.status : "forecast",
    modules: Number(job.modules) || 12,
    crew: Number(job.crew) || 10,
    priority: job.priority || "Medium",
    progress: clamp(Number(job.progress) || 0, 0, 100),
    readiness: {
      drawings: Boolean(job.readiness?.drawings),
      materials: Boolean(job.readiness?.materials),
      permits: Boolean(job.readiness?.permits),
      inspections: Boolean(job.readiness?.inspections),
    },
    notes: job.notes || "",
    pm: job.pm || "",
    sourceType: job.sourceType || "",
    sourceSheet: job.sourceSheet || "",
    sourceRow: job.sourceRow || "",
    jobNumber: job.jobNumber || job.job_number || "",
    master: {
      contract: job.master?.contract || "",
      submittalsOut: job.master?.submittalsOut || "",
      submittalsReceived: job.master?.submittalsReceived || "",
      dsaStatus: job.master?.dsaStatus || "",
      dsaRedlines: job.master?.dsaRedlines || "",
      dsaApproval: job.master?.dsaApproval || "",
      inspector: job.master?.inspector || "",
      jobCard: job.master?.jobCard || "",
      lab: job.master?.lab || "",
      subcontractStatus: job.master?.subcontractStatus || "",
      openItems: job.master?.openItems || "",
      pmUpdate: job.master?.pmUpdate || "",
    },
    procore: {
      projectId:             job.procore?.projectId             ?? null,
      rfiOpenCount:          job.procore?.rfiOpenCount          ?? 0,
      rfiOverdueCount:       job.procore?.rfiOverdueCount       ?? 0,
      punchOpenCount:        job.procore?.punchOpenCount        ?? 0,
      punchScheduleImpact:   job.procore?.punchScheduleImpact   ?? 0,
      changeEventCount:      job.procore?.changeEventCount      ?? 0,
      inspectionDeficient:   job.procore?.inspectionDeficient   ?? 0,
      observationOpenCount:  job.procore?.observationOpenCount  ?? 0,
      primeContractExecuted: job.procore?.primeContractExecuted ?? false,
      primeContractDate:     job.procore?.primeContractDate     ?? "",
      subcontractExecuted:   job.procore?.subcontractExecuted   ?? false,
      subcontractAmount:     job.procore?.subcontractAmount     ?? null,
      subcontractDate:       job.procore?.subcontractDate       ?? "",
    },
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return headers.reduce((row, h, i) => ({ ...row, [h]: values[i] || "" }), {});
  });
}

function jobsToCSV(jobs) {
  const headers = [
    "id","name","client","line","start","topsetComplete","end","due","color","status",
    "modules","crew","priority","progress",
    "drawings_ready","materials_ready","permits_ready","inspections_ready","notes",
  ];
  const rows = jobs.map((job) =>
    [
      job.id, job.name, job.client, job.line, job.start, job.offLine, job.end, job.due,
      job.color, job.status, job.modules, job.crew, job.priority, job.progress,
      job.readiness.drawings, job.readiness.materials,
      job.readiness.permits, job.readiness.inspections,
      `"${(job.notes || "").replace(/"/g, '""')}"`,
    ].join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function csvRowToJob(row, index) {
  return normalizeJob(
    {
      ...row,
      name: row.name || row.job_name,
      start: row.start || row.start_date,
      offLine: row.topsetComplete || row.topset_complete || row.offLine || row.off_line,
      end: row.end || row.end_date,
      due: row.due || row.due_date,
      readiness: {
        drawings: row.drawings_ready === "true",
        materials: row.materials_ready === "true",
        permits: row.permits_ready === "true",
        inspections: row.inspections_ready === "true",
      },
    },
    index,
  );
}

function Button({ children, tone = "default", ...props }) {
  return (
    <button className={`ps-button ps-button-${tone}`} type="button" {...props}>
      {children}
    </button>
  );
}

function Kpi({ label, value, sublabel, tone = "neutral", onClick, active = false }) {
  return (
    <button
      className={`ps-kpi ps-kpi-${tone} ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
      disabled={!onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sublabel}</small>
    </button>
  );
}

function StatusChip({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.forecast;
  return (
    <span className="ps-chip" style={{ color: config.color, background: config.bg }}>
      {config.label}
    </span>
  );
}

const PIPELINE_STAGES = [
  { id: "lead", label: "Lead", probability: 15 },
  { id: "estimate", label: "Estimating", probability: 35 },
  { id: "proposal", label: "Proposal", probability: 55 },
  { id: "award", label: "Verbal Award", probability: 80 },
  { id: "handoff", label: "Contract Handoff", probability: 95 },
];

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatProtectedMoney(value, canViewPrices) {
  return canViewPrices ? formatMoney(value) : "Price locked";
}

function getProjectedRevenue(job) {
  return job.modules * 145000;
}

function getPipelineStage(job, index) {
  if (job.status === "forecast") return PIPELINE_STAGES[index % 3];
  if (job.status === "hold") return PIPELINE_STAGES[2];
  if (job.status === "approved") return PIPELINE_STAGES[3];
  return PIPELINE_STAGES[4];
}

const SAMPLE_PIPELINE_DEALS = SAMPLE_JOBS.map((job, index) => {
  const stage = getPipelineStage(job, index);
  const amount = getProjectedRevenue(job);
  return {
    id: `deal-${job.id}`,
    opportunityName: job.name,
    client: job.client,
    stage: stage.id,
    probability: stage.probability,
    amount,
    weightedAmount: Math.round(amount * (stage.probability / 100)),
    expectedCloseDate: addDays(job.start, -45 - (index % 4) * 12),
    estimator: "",
    projectManager: "",
    notes: job.notes || "",
    sourceType: "",
    sourceSheet: "",
    sourceRow: null,
  };
});

function integrationStatus(job) {
  const hasNetSuite = Boolean(job.jobNumber || job.master?.contract || job.sourceType === "master");
  const hasProcore = Boolean(job.master?.submittalsOut || job.master?.dsaStatus || job.master?.inspector);

  if (hasNetSuite && hasProcore) return { label: "Linked", tone: "green" };
  if (hasNetSuite || hasProcore) return { label: "Partial", tone: "amber" };
  return { label: "Missing IDs", tone: "red" };
}

function isDateInRange(day, start, end) {
  return day >= start && day <= end;
}

function ModuleWorkspace({
  module,
  jobs,
  pipelineDeals,
  setPipelineDeals,
  submittals,
  kpis,
  risks,
  overlaps,
  lineUtilization,
  excelSync,
  onOpenProduction,
  onFilterByPm,
  onAddJobFromDeal,
  onOpenFactSheet,
  canViewPrices,
  userAdmin,
}) {
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineClientFilter, setPipelineClientFilter] = useState("all");
  const [pipelineBdmFilter, setPipelineBdmFilter] = useState("all");
  const [pipelineStageFilter, setPipelineStageFilter] = useState("all");
  const [pipelineBuildingFilter, setPipelineBuildingFilter] = useState("all");
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [subLineFilter, setSubLineFilter] = useState("all");
  // Active Production state — hoisted here to satisfy Rules of Hooks
  const [editingCell, setEditingCell] = useState(null);
  const [apSearch, setApSearch] = useState("");
  const [apLineFilter, setApLineFilter] = useState("all");
  const [apStatusFilter, setApStatusFilter] = useState("all");
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [batchShiftDays, setBatchShiftDays] = useState("");
  const [showBatchShift, setShowBatchShift] = useState(false);
  // Procore integration panel state
  const [procoreActivity, setProcoreActivity] = useState([]);
  useEffect(() => {
    if (!supabaseClient) return;
    supabaseClient.from("activity_log")
      .select("*")
      .in("action", ["procore_submittal_sync", "procore_daily_log_synced"])
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setProcoreActivity(data); });
  }, []);

  function startEdit(jobId, field) { setEditingCell({ jobId, field }); }
  function commitEdit(jobId, field, value) {
    if (field.startsWith("master.")) {
      updateMasterField(jobId, field.replace("master.", ""), value);
    } else {
      updateJob(jobId, { [field]: value });
    }
    setEditingCell(null);
  }
  function EditableCell({ job, field, type = "text", options, placeholder }) {
    const isEditing = editingCell?.jobId === job.id && editingCell?.field === field;
    const rawValue = field.startsWith("master.")
      ? job.master?.[field.replace("master.", "")] ?? ""
      : job[field] ?? "";
    if (!isEditing) {
      return (
        <div className="ps-ap-cell" onClick={() => startEdit(job.id, field)} title="Click to edit">
          {rawValue
            ? (type === "date" ? displayDate(rawValue) : rawValue)
            : <span className="ps-ap-empty">{placeholder || "—"}</span>}
        </div>
      );
    }
    if (options) {
      return (
        <select className="ps-ap-input" autoFocus value={rawValue}
          onChange={(e) => commitEdit(job.id, field, e.target.value)}
          onBlur={() => setEditingCell(null)}>
          {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      );
    }
    return (
      <input className="ps-ap-input" autoFocus type={type === "date" ? "date" : "text"} value={rawValue}
        onChange={(e) => {
          if (field.startsWith("master.")) { updateMasterField(job.id, field.replace("master.", ""), e.target.value); }
          else { updateJob(job.id, { [field]: e.target.value }); }
        }}
        onBlur={() => setEditingCell(null)}
        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(job.id, field, e.target.value); if (e.key === "Escape") setEditingCell(null); }}
        placeholder={placeholder}
      />
    );
  }

  const pipelineRows = pipelineDeals.map((deal, index) => {
    const stage = PIPELINE_STAGES.find((item) => item.id === deal.stage) || getPipelineStage(jobs[index] || { status: "forecast" }, index);
    const revenue = Number(deal.amount) || 0;
    return {
      deal,
      stage,
      revenue,
      weighted: Number(deal.weightedAmount) || Math.round(revenue * (stage.probability / 100)),
      closeDate: deal.expectedCloseDate || addDays(formatDate(new Date()), 30 + index * 7),
    };
  });

  const pipelineClients = Array.from(new Set(pipelineRows.map((row) => row.deal.client).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const pipelineBdms = Array.from(new Set(pipelineRows.map((row) => row.deal.estimator).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const pipelineBuildingTypes = Array.from(new Set(pipelineRows.map((row) => row.deal.buildingType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const filteredPipelineRows = pipelineRows.filter(({ deal, stage }) => {
    const matchesClient = pipelineClientFilter === "all" || deal.client === pipelineClientFilter;
    const matchesBdm = pipelineBdmFilter === "all" || (deal.estimator || "") === pipelineBdmFilter;
    const matchesStage = pipelineStageFilter === "all" || stage.id === pipelineStageFilter;
    const matchesBuilding = pipelineBuildingFilter === "all" || (deal.buildingType || "") === pipelineBuildingFilter;
    const haystack = `${deal.opportunityName} ${deal.client} ${deal.notes || ""} ${deal.jobNumber || ""}`.toLowerCase();
    const matchesSearch = !pipelineSearch.trim() || haystack.includes(pipelineSearch.trim().toLowerCase());
    return matchesClient && matchesBdm && matchesStage && matchesBuilding && matchesSearch;
  });

  const pipelineTotals = PIPELINE_STAGES.map((stage) => {
    const rows = pipelineRows.filter((row) => row.stage.id === stage.id);
    return {
      ...stage,
      count: rows.length,
      modules: rows.length,
      weighted: rows.reduce((sum, row) => sum + row.weighted, 0),
    };
  });

  const bridgeGaps = jobs
    .map((job) => ({ job, integration: integrationStatus(job), readiness: readinessScore(job) }))
    .filter(({ integration, readiness }) => integration.tone !== "green" || readiness < 100)
    .slice(0, 8);

  const today = formatDate(new Date());
  const lineOperations = LINES.map((line) => {
    const lineJobs = jobs
      .filter((job) => job.line === line.id)
      .sort((a, b) => a.start.localeCompare(b.start));
    const currentJob = lineJobs.find((job) => isDateInRange(today, job.start, job.end)) || null;
    const activeCount = lineJobs.filter((job) => isDateInRange(today, job.start, job.end)).length;
    const upcoming = lineJobs.filter((job) => job.start > today);
    const completed = lineJobs.filter((job) => job.end < today);
    const latestEnd = lineJobs.reduce((max, job) => (job.end > max ? job.end : max), "");
    const nextStart = upcoming.reduce((min, job) => (!min || job.start < min ? job.start : min), "");
    const hasGap = Boolean(latestEnd && nextStart && nextStart > addDays(latestEnd, 2));
    const outlookEnd = addDays(today, 90);
    const outlookJobs = lineJobs.filter((job) => job.start <= outlookEnd && job.end >= today);
    const futurePairs = lineJobs
      .filter((job) => job.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    let futureGapDays = 0;
    for (let i = 0; i < futurePairs.length - 1; i += 1) {
      const gap = dateDiffDays(futurePairs[i].end, futurePairs[i + 1].start) - 1;
      if (gap > futureGapDays) futureGapDays = gap;
    }
    const overlapCount = overlaps.filter((item) => item.line === line.id).length;
    const statusTone = overlapCount ? "red" : (currentJob ? "green" : (hasGap ? "amber" : "blue"));
    const statusLabel = overlapCount
      ? "Overlap risk"
      : currentJob
        ? "Running"
        : hasGap
          ? "Gap risk"
          : "Planned";

    return {
      line,
      lineJobs,
      currentJob,
      activeCount,
      upcoming,
      completed,
      outlookJobs,
      futureGapDays,
      hasGap,
      overlapCount,
      statusTone,
      statusLabel,
    };
  });
  const totalOverlaps = overlaps.length;
  const totalGapLines = lineOperations.filter((line) => line.hasGap).length;
  const idleLines = lineOperations.filter((line) => !line.currentJob).length;
  const upcoming7Days = jobs.filter((job) => job.start > today && job.start <= addDays(today, 7)).length;
  const lateJobs = jobs.filter((job) => LINE_IDS.includes(job.line) && job.end > job.due).length;
  const completedThisWeek = jobs.filter((job) => job.end >= addDays(today, -7) && job.end <= today).length;
  const avgLineUtil = Math.round(lineUtilization.reduce((sum, line) => sum + line.utilization, 0) / Math.max(1, lineUtilization.length));

  if (module.id === "dashboard") {
    const totalModules = jobs.reduce((s, j) => s + j.modules, 0);
    const activeJobs = lineOperations.reduce((s, r) => s + r.activeCount, 0);
    const avgReadiness = Math.round(jobs.reduce((s, j) => s + readinessScore(j), 0) / Math.max(1, jobs.length));
    const pendingSubmittals = jobs.filter((j) => j.master?.submittalsOut && !j.master?.submittalsReceived).length;
    const totalPipelineWeighted = pipelineDeals.reduce((s, d) => s + (Number(d.weightedAmount) || 0), 0);

    // PM workload: split "Joe/Rod" → each PM gets their own row
    const pmWorkload = (() => {
      const map = new Map();
      const today30 = addDays(today, 30);
      jobs.forEach((j) => {
        if (!j.pm) return;
        j.pm.split(/[/,&]+/).map((s) => s.trim()).filter(Boolean).forEach((name) => {
          if (!map.has(name)) map.set(name, { name, total: 0, inProd: 0, openItems: 0, shippingSoon: 0, lateJobs: 0 });
          const row = map.get(name);
          row.total++;
          if (j.status === "production") row.inProd++;
          if (j.master?.openItems) row.openItems++;
          if (j.end && j.end >= today && j.end <= today30) row.shippingSoon++;
          if (j.end && j.end < today && j.status !== "complete") row.lateJobs++;
        });
      });
      return [...map.values()].sort((a, b) => b.inProd - a.inProd || b.total - a.total);
    })();

    return (
      <section className="ps-dash" aria-label="Company Dashboard">

        {/* ── Hero stat strip ───────────────────────────────────────────── */}
        <div className="ps-dash-hero">
          <div className="ps-dash-hero-brand">
            <div className="ps-dash-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2L36 11.5V28.5L20 38L4 28.5V11.5L20 2Z" fill="#F97316" opacity="0.2"/>
                <path d="M20 6L10 12V24L20 30L30 24V12L20 6Z" fill="#F97316" opacity="0.55"/>
                <path d="M20 11L13 15V23L20 27L27 23V15L20 11Z" fill="#F97316"/>
              </svg>
            </div>
            <div>
              <p className="ps-dash-hero-eyebrow">Purpose-Built, People-Powered</p>
              <h1 className="ps-dash-hero-title">Silver Creek Modular</h1>
              <p className="ps-dash-hero-sub">Building smarter for the next generation · Perris, CA</p>
            </div>
          </div>
          <div className="ps-dash-hero-stats">
            <div className="ps-dash-hero-stat">
              <strong>{jobs.length}</strong>
              <span>Active Jobs</span>
            </div>
            <div className="ps-dash-hero-stat">
              <strong>{totalModules}</strong>
              <span>Modules Scheduled</span>
            </div>
            <div className="ps-dash-hero-stat">
              <strong>{avgLineUtil}%</strong>
              <span>Plant Utilization</span>
            </div>
            <div className="ps-dash-hero-stat">
              <strong>{avgReadiness}%</strong>
              <span>Avg Readiness</span>
            </div>
          </div>
        </div>

        {/* ── Top KPI row ───────────────────────────────────────────────── */}
        <div className="ps-dash-kpi-row">
          <div className={`ps-dash-kpi${activeJobs > 0 ? " is-orange" : ""}`}>
            <div className="ps-dash-kpi-icon">▣</div>
            <div>
              <strong>{activeJobs}</strong>
              <span>Currently On Line</span>
            </div>
          </div>
          <div className={`ps-dash-kpi${lateJobs > 0 ? " is-red" : " is-green"}`}>
            <div className="ps-dash-kpi-icon">{lateJobs > 0 ? "⚠" : "✓"}</div>
            <div>
              <strong>{lateJobs}</strong>
              <span>Late Jobs</span>
            </div>
          </div>
          <div className={`ps-dash-kpi${totalOverlaps > 0 ? " is-red" : " is-green"}`}>
            <div className="ps-dash-kpi-icon">⊞</div>
            <div>
              <strong>{totalOverlaps}</strong>
              <span>Line Overlaps</span>
            </div>
          </div>
          <div className={`ps-dash-kpi${pendingSubmittals > 0 ? " is-amber" : " is-green"}`}>
            <div className="ps-dash-kpi-icon">◈</div>
            <div>
              <strong>{pendingSubmittals}</strong>
              <span>Submittals Pending</span>
            </div>
          </div>
          <div className={`ps-dash-kpi${idleLines > 0 ? " is-amber" : " is-green"}`}>
            <div className="ps-dash-kpi-icon">◉</div>
            <div>
              <strong>{idleLines}</strong>
              <span>Idle Lines</span>
            </div>
          </div>
          <div className="ps-dash-kpi is-purple">
            <div className="ps-dash-kpi-icon">$</div>
            <div>
              <strong>{canViewPrices ? formatMoney(totalPipelineWeighted) : "—"}</strong>
              <span>Weighted Pipeline</span>
            </div>
          </div>
        </div>

        <div className="ps-dash-body">

          {/* ── Line status cards ─────────────────────────────────────── */}
          <div className="ps-dash-col ps-dash-col-main">
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Production Lines</h2>
                <span>Live status across all 4 factory lines</span>
              </div>
              <div className="ps-dash-lines">
                {lineOperations.map((row) => {
                  const util = lineUtilization.find((u) => u.line === row.line.id);
                  const tone = row.overlapCount ? "red" : row.currentJob ? "green" : row.hasGap ? "amber" : "blue";
                  const pct = util?.utilization || 0;
                  return (
                    <div key={row.line.id} className={`ps-dash-line-card is-${tone}`}>
                      <div className="ps-dash-line-header">
                        <div className="ps-dash-line-title">
                          <span className={`ps-dash-line-dot is-${tone}`} />
                          <strong>{row.line.name}</strong>
                          <small>{row.line.focus}</small>
                        </div>
                        <div className="ps-dash-line-meta">
                          <span className={`ps-queue-badge is-${tone}`}>{row.statusLabel}</span>
                          {(row.currentJob || row.upcoming[0]) && (
                            <button type="button" className="ps-dash-open-btn" onClick={() => onOpenProduction((row.currentJob || row.upcoming[0]).id)}>
                              Open →
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="ps-dash-line-body">
                        <div className="ps-dash-line-job">
                          <span>Active</span>
                          <strong>{row.currentJob?.name || "No active job"}</strong>
                        </div>
                        <div className="ps-dash-line-job">
                          <span>Next</span>
                          <strong>{row.upcoming[0] ? `${row.upcoming[0].name} · ${displayDate(row.upcoming[0].start)}` : "Nothing queued"}</strong>
                        </div>
                      </div>
                      <div className="ps-dash-line-footer">
                        <div className="ps-dash-util-track">
                          <div className={`ps-dash-util-fill is-${pct >= 85 ? "red" : pct >= 60 ? "amber" : "green"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span>{pct}% utilized · {util?.jobs || 0} jobs · {util?.modules || 0} modules</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Week-ahead digest */}
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Week Ahead</h2>
                <span>Jobs starting, shipping, and setting in the next 7 days</span>
              </div>
              <div className="ps-week-ahead">
                {["Starting", "Shipping", "Setting"].map((type, ti) => {
                  const weekEnd = addDays(today, 7);
                  const digest = jobs.filter((j) => {
                    if (ti === 0) return j.start >= today && j.start <= weekEnd;
                    if (ti === 1) return j.end >= today && j.end <= weekEnd;
                    return j.due >= today && j.due <= weekEnd;
                  });
                  return (
                    <div key={type} className="ps-week-col">
                      <div className="ps-week-col-head">{type} <span>{digest.length}</span></div>
                      {digest.length === 0
                        ? <p className="ps-empty" style={{ padding: "6px 0", fontSize: 11 }}>None this week</p>
                        : digest.map((j) => (
                          <button key={j.id} type="button" className="ps-week-job" onClick={() => onOpenProduction(j.id)}>
                            <i style={{ background: j.color }} />
                            <span>{j.name}</span>
                            <small>{j.line} · {ti === 0 ? displayDate(j.start) : ti === 1 ? displayDate(j.end) : displayDate(j.due)}</small>
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Right column ──────────────────────────────────────────── */}
          <div className="ps-dash-col ps-dash-col-side">

            {/* Alerts */}
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Active Alerts</h2>
                <span>{risks.length} issues requiring attention</span>
              </div>
              <div className="ps-dash-alerts">
                {risks.length === 0 && <p className="ps-empty">No active alerts — all clear.</p>}
                {risks.map((risk, i) => (
                  <button key={i} type="button" className={`ps-dash-alert-row is-${risk.type === "Late" || risk.type === "Overlap" ? "red" : risk.type === "Delay" || risk.type === "Hold" ? "amber" : "blue"}`}
                    onClick={() => risk.job && onOpenProduction(risk.job.id)}>
                    <span className={`ps-status-dot is-${risk.type === "Late" || risk.type === "Overlap" ? "red" : risk.type === "Delay" ? "amber" : "blue"}`} />
                    <div>
                      <strong>{risk.type}</strong>
                      <small>{risk.job ? jobLabel(risk.job) : risk.detail}</small>
                    </div>
                    {risk.job && <span className="ps-dash-alert-arrow">→</span>}
                  </button>
                ))}
              </div>
            </section>

            {/* Late jobs */}
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Late Jobs</h2>
                <span>Ship date exceeds customer set date</span>
              </div>
              {lateJobs === 0
                ? <p className="ps-empty" style={{ padding: "12px 16px" }}>No late jobs — all on schedule.</p>
                : <div className="ps-dash-late-list">
                    {jobs.filter((j) => LINE_IDS.includes(j.line) && j.end > j.due)
                      .sort((a, b) => dateDiffDays(b.due, b.end) - dateDiffDays(a.due, a.end))
                      .map((j) => (
                        <button key={j.id} type="button" className="ps-dash-late-row" onClick={() => onOpenProduction(j.id)}>
                          <i style={{ background: j.color }} />
                          <div>
                            <strong>{j.name}</strong>
                            <small>{j.client} · {j.line}</small>
                          </div>
                          <span className="ps-pill is-red">{dateDiffDays(j.due, j.end)}d late</span>
                        </button>
                      ))}
                  </div>}
            </section>

            {/* Readiness exceptions */}
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Readiness Gaps</h2>
                <span>Active jobs below 100% readiness</span>
              </div>
              <div className="ps-dash-readiness-list">
                {jobs.filter((j) => j.line !== QUEUE && readinessScore(j) < 100)
                  .sort((a, b) => readinessScore(a) - readinessScore(b))
                  .slice(0, 5)
                  .map((j) => {
                    const score = readinessScore(j);
                    return (
                      <button key={j.id} type="button" className="ps-dash-readiness-row" onClick={() => onOpenProduction(j.id)}>
                        <div className="ps-dash-readiness-info">
                          <strong>{j.name}</strong>
                          <small>{["drawings","materials","permits","inspections"].filter((k) => !j.readiness[k]).join(", ")} missing</small>
                        </div>
                        <div className="ps-dash-readiness-bar">
                          <div className={`ps-capacity-bar-fill is-${score >= 75 ? "amber" : "red"}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className={`ps-dash-readiness-pct${score < 50 ? " is-low" : ""}`}>{score}%</span>
                      </button>
                    );
                  })}
                {jobs.filter((j) => j.line !== QUEUE && readinessScore(j) < 100).length === 0 && (
                  <p className="ps-empty" style={{ padding: "12px 16px" }}>All active jobs are 100% ready.</p>
                )}
              </div>
            </section>

            {/* Pipeline funnel summary */}
            <section className="ps-dash-panel">
              <div className="ps-dash-panel-head">
                <h2>Pipeline Summary</h2>
                <span>Deals by stage</span>
              </div>
              <div className="ps-dash-funnel">
                {PIPELINE_STAGES.map((stage) => {
                  const count = pipelineDeals.filter((d) => d.stage === stage.id).length;
                  const weighted = pipelineDeals.filter((d) => d.stage === stage.id).reduce((s, d) => s + (Number(d.weightedAmount) || 0), 0);
                  return (
                    <div key={stage.id} className="ps-dash-funnel-row">
                      <span className="ps-dash-funnel-label">{stage.label}</span>
                      <div className="ps-dash-funnel-bar-track">
                        <div className="ps-dash-funnel-bar-fill" style={{ width: `${stage.probability}%` }} />
                      </div>
                      <span className="ps-dash-funnel-count">{count} deal{count !== 1 ? "s" : ""}</span>
                      <span className="ps-dash-funnel-val">{canViewPrices ? formatMoney(weighted) : "—"}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* PM Workload Table */}
        {pmWorkload.length > 0 && (
          <div className="ps-dash-pm-section">
            <div className="ps-dash-panel-head" style={{ marginBottom: 16 }}>
              <h2>PM Workload</h2>
              <span>Active jobs, open items &amp; upcoming ships per Project Manager</span>
            </div>
            <div className="ps-dash-pm-grid">
              <div className="ps-dash-pm-row ps-dash-pm-header">
                <span>PM</span>
                <span>Total Jobs</span>
                <span>In Production</span>
                <span>Ships ≤ 30 days</span>
                <span>Open Items</span>
                <span>Late</span>
                <span></span>
              </div>
              {pmWorkload.map((row) => (
                <div key={row.name} className="ps-dash-pm-row">
                  <span className="ps-dash-pm-name">{row.name}</span>
                  <span>{row.total}</span>
                  <span>
                    <span className={`ps-pm-badge${row.inProd > 0 ? " is-prod" : ""}`}>{row.inProd}</span>
                  </span>
                  <span>
                    {row.shippingSoon > 0
                      ? <span className="ps-pm-badge is-ship">{row.shippingSoon}</span>
                      : <span className="ps-pm-zero">—</span>}
                  </span>
                  <span>
                    {row.openItems > 0
                      ? <span className="ps-pm-badge is-warn">{row.openItems}</span>
                      : <span className="ps-pm-zero">—</span>}
                  </span>
                  <span>
                    {row.lateJobs > 0
                      ? <span className="ps-pm-badge is-late">{row.lateJobs}</span>
                      : <span className="ps-pm-zero">—</span>}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="ps-pm-filter-btn"
                      onClick={() => onFilterByPm(row.name)}
                    >
                      View jobs →
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Procore Integration Status ─────────────────────────────────── */}
        <div className="ps-dash-pm-section" style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Procore Integration</h2>
            <span className={`ps-pm-badge ${procoreActivity.length > 0 ? "is-prod" : ""}`}
              style={{ fontSize: 12, padding: "2px 10px", borderRadius: 99 }}>
              {procoreActivity.length > 0 ? "● Live" : "○ No events yet"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
            Webhook: <code style={{ background: "#f3f4f6", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>
              https://ixbffxowwvpzzuamvgix.supabase.co/functions/v1/procore-webhook
            </code>
          </div>
          {procoreActivity.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
              No synced events yet — configure Procore to send submittals.update and daily_logs.create to the webhook URL above.
            </p>
          ) : (
            <div className="ps-dash-pm-grid" style={{ gridTemplateColumns: "1fr 1fr 2fr", gap: 0 }}>
              <div className="ps-dash-pm-row ps-dash-pm-header">
                <span>Time</span>
                <span>Event</span>
                <span>Detail</span>
              </div>
              {procoreActivity.map((ev) => (
                <div key={ev.id} className="ps-dash-pm-row">
                  <span style={{ color: "#6b7280", fontSize: 12 }}>
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}
                  </span>
                  <span>
                    <span className={`ps-pm-badge ${ev.action === "procore_submittal_sync" ? "is-ship" : "is-prod"}`}
                      style={{ fontSize: 11 }}>
                      {ev.action === "procore_submittal_sync" ? "Submittal" : "Daily Log"}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: "#374151" }}>
                    {ev.detail?.procore_status ? `Status: ${ev.detail.procore_status}` : ""}
                    {ev.detail?.date ? ` Date: ${ev.detail.date}` : ""}
                    {ev.detail?.job_id ? ` · Job: ${ev.detail.job_id}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (module.id === "pipeline") {
    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Sales to production" />
        <PipelineKanban
          deals={pipelineDeals}
          setDeals={setPipelineDeals}
          onAddJobFromDeal={onAddJobFromDeal}
          canViewPrices={canViewPrices}
          onOpenJobRecord={onOpenFactSheet}
        />
      </section>
    );
  }

  if (module.id === "capacity") {
    // Build month buckets for the next 12 months
    const today2 = formatDate(new Date());
    const capacityMonths = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthStart = formatDate(new Date(year, month, 1));
      const monthEnd = formatDate(new Date(year, month + 1, 0));
      const label = `${MONTHS[month]} ${year}`;

      // Scheduled load: sum days-on-line per line per month
      const lineLoad = LINES.map((line) => {
        const lineJobs = jobs.filter((j) => j.line === line.id);
        const daysInMo = daysInMonth(year, month);
        let usedDays = 0;
        for (const j of lineJobs) {
          const overlapStart = j.start > monthStart ? j.start : monthStart;
          const overlapEnd = j.offLine < monthEnd ? j.offLine : monthEnd;
          if (overlapStart <= overlapEnd) {
            usedDays += dateDiffDays(overlapStart, overlapEnd);
          }
        }
        return { line: line.id, name: line.name, usedDays, capacity: daysInMo, pct: Math.min(100, Math.round((usedDays / daysInMo) * 100)) };
      });

      // Pipeline demand: weighted module count for deals with close dates in this month
      const pipelineDemand = pipelineDeals.filter((d2) => {
        const cd = d2.expectedCloseDate || "";
        return cd >= monthStart && cd <= monthEnd;
      }).reduce((sum, d2) => sum + (Number(d2.weightedAmount) || 0), 0);

      // Total modules scheduled
      const scheduledModules = jobs.filter((j) => j.line !== QUEUE && j.start <= monthEnd && (j.offLine || j.end) >= monthStart)
        .reduce((sum, j) => sum + j.modules, 0);

      const avgPct = Math.round(lineLoad.reduce((s, l) => s + l.pct, 0) / LINES.length);
      const tone = avgPct >= 90 ? "red" : avgPct >= 65 ? "amber" : avgPct >= 30 ? "green" : "blue";

      capacityMonths.push({ label, monthStart, monthEnd, lineLoad, pipelineDemand, scheduledModules, avgPct, tone });
    }

    // Yearly totals
    const totalScheduledModules = jobs.filter((j) => j.line !== QUEUE).reduce((s, j) => s + j.modules, 0);
    const totalWeightedPipeline = pipelineDeals.reduce((s, d) => s + (Number(d.weightedAmount) || 0), 0);
    const avgUtilAll = Math.round(capacityMonths.reduce((s, m) => s + m.avgPct, 0) / capacityMonths.length);

    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="12-month forward view" />

        {/* Summary KPI row */}
        <div className="ps-capacity-kpi-row">
          <div className="ps-capacity-kpi">
            <span>Avg Plant Utilization</span>
            <strong>{avgUtilAll}%</strong>
            <small>next 12 months</small>
          </div>
          <div className="ps-capacity-kpi">
            <span>Scheduled Modules</span>
            <strong>{totalScheduledModules}</strong>
            <small>on production lines</small>
          </div>
          <div className="ps-capacity-kpi">
            <span>Weighted Pipeline</span>
            <strong>{canViewPrices ? formatMoney(totalWeightedPipeline) : "Locked"}</strong>
            <small>probability-adjusted</small>
          </div>
          <div className="ps-capacity-kpi">
            <span>Lines</span>
            <strong>{LINES.length}</strong>
            <small>production lines tracked</small>
          </div>
        </div>

        {/* Month-by-month chart */}
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Monthly Line Load</h2>
            <span>Bar = % of working days occupied per line · Red = &gt;90% · Amber = 65–90% · Green = 30–65% · Blue = &lt;30%</span>
          </div>
          <div className="ps-capacity-chart">
            {capacityMonths.map((mo) => (
              <div key={mo.label} className="ps-capacity-month">
                <div className="ps-capacity-month-label">{mo.label}</div>
                <div className="ps-capacity-bars">
                  {mo.lineLoad.map((ll) => (
                    <div key={ll.line} className="ps-capacity-bar-row">
                      <span className="ps-capacity-line-label">{ll.line}</span>
                      <div className="ps-capacity-bar-track">
                        <div
                          className={`ps-capacity-bar-fill is-${ll.pct >= 90 ? "red" : ll.pct >= 65 ? "amber" : ll.pct >= 30 ? "green" : "blue"}`}
                          style={{ width: `${ll.pct}%` }}
                        />
                      </div>
                      <span className="ps-capacity-bar-pct">{ll.pct}%</span>
                    </div>
                  ))}
                </div>
                <div className={`ps-capacity-avg is-${mo.tone}`}>{mo.avgPct}% avg</div>
                {mo.pipelineDemand > 0 && (
                  <div className="ps-capacity-pipeline-note">
                    {canViewPrices ? `+${formatMoney(mo.pipelineDemand)} pipeline closing` : "+pipeline demand"}
                  </div>
                )}
                {mo.scheduledModules > 0 && (
                  <div className="ps-capacity-modules-note">{mo.scheduledModules} modules on line</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Per-line detail table */}
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Line-by-Line Forecast</h2>
            <span>Current utilization and upcoming scheduled work per line</span>
          </div>
          <div className="ps-project-table">
            <div className="ps-project-row is-header">
              <span>Line</span><span>Focus</span><span>Jobs Scheduled</span><span>Modules</span><span>Utilization</span><span>Status</span>
            </div>
            {LINES.map((line) => {
              const util = lineUtilization.find((u) => u.line === line.id);
              const lineJobs = jobs.filter((j) => j.line === line.id);
              const tone = (util?.utilization || 0) >= 90 ? "red" : (util?.utilization || 0) >= 65 ? "amber" : "green";
              return (
                <div key={line.id} className="ps-project-row">
                  <span><strong>{line.name}</strong></span>
                  <span><small>{line.focus}</small></span>
                  <span><strong>{lineJobs.length}</strong></span>
                  <span><strong>{util?.modules || 0}</strong></span>
                  <span>
                    <div className="ps-capacity-bar-track" style={{ maxWidth: 120 }}>
                      <div className={`ps-capacity-bar-fill is-${tone}`} style={{ width: `${util?.utilization || 0}%` }} />
                    </div>
                    <small style={{ marginLeft: 6 }}>{util?.utilization || 0}%</small>
                  </span>
                  <span><i className={`ps-pill is-${tone}`}>{tone === "red" ? "Near full" : tone === "amber" ? "Filling" : "Available"}</i></span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Gap risk warnings */}
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Capacity Warnings</h2>
            <span>Months where average line load exceeds 80% or drops below 20%</span>
          </div>
          <div className="ps-compact-list">
            {capacityMonths.filter((m) => m.avgPct >= 80 || m.avgPct < 20).length === 0 && (
              <p className="ps-empty">No capacity warnings in the next 12 months.</p>
            )}
            {capacityMonths.filter((m) => m.avgPct >= 80 || m.avgPct < 20).map((m) => (
              <div key={m.label} className={`ps-alert-row is-${m.avgPct >= 80 ? "red" : "blue"}`}>
                <span className={`ps-status-dot is-${m.avgPct >= 80 ? "red" : "blue"}`} />
                <strong>{m.label}</strong>
                <small>{m.avgPct >= 80 ? `Overload risk — ${m.avgPct}% average utilization` : `Idle risk — only ${m.avgPct}% utilization`}</small>
              </div>
            ))}
          </div>
        </section>
      </section>
    );
  }

  if (module.id === "submittals") {
    const submittableJobs = jobs.filter((j) => j.line !== QUEUE && j.status !== "forecast");

    // Compute aging for submittals sent but not received
    const todayMs = new Date().getTime();
    function agingDays(dateStr) {
      if (!dateStr) return null;
      const d = toDate(dateStr);
      if (isNaN(d)) return null;
      return Math.floor((todayMs - d.getTime()) / MS_PER_DAY);
    }

    const filteredSubJobs = submittableJobs.filter((j) => {
      const matchLine = subLineFilter === "all" || j.line === subLineFilter;
      const matchStatus = subStatusFilter === "all" || j.status === subStatusFilter;
      const hay = `${j.name} ${j.client} ${j.jobNumber || ""} ${j.master?.inspector || ""} ${j.master?.dsaStatus || ""}`.toLowerCase();
      const matchSearch = !subSearch.trim() || hay.includes(subSearch.trim().toLowerCase());
      return matchLine && matchStatus && matchSearch;
    });

    // Summary counts
    const pendingSubs = submittableJobs.filter((j) => j.master?.submittalsOut && !j.master?.submittalsReceived).length;
    const dsaPending = submittableJobs.filter((j) => j.master?.dsaStatus && !j.master?.dsaApproval).length;
    const noInspector = submittableJobs.filter((j) => !j.master?.inspector).length;
    const overdueReview = submittableJobs.filter((j) => {
      const age = agingDays(j.master?.submittalsOut);
      return age !== null && !j.master?.submittalsReceived && age > 21;
    }).length;

    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Document control" />

        {/* Summary chips */}
        <div className="ps-capacity-kpi-row">
          <div className={`ps-capacity-kpi${pendingSubs > 0 ? " is-warn" : ""}`}>
            <span>Submittals Pending Return</span>
            <strong>{pendingSubs}</strong>
            <small>sent, awaiting receipt</small>
          </div>
          <div className={`ps-capacity-kpi${overdueReview > 0 ? " is-warn" : ""}`}>
            <span>Overdue Reviews</span>
            <strong>{overdueReview}</strong>
            <small>&gt;21 days without response</small>
          </div>
          <div className={`ps-capacity-kpi${dsaPending > 0 ? " is-warn" : ""}`}>
            <span>DSA Approvals Pending</span>
            <strong>{dsaPending}</strong>
            <small>in DSA review process</small>
          </div>
          <div className={`ps-capacity-kpi${noInspector > 0 ? " is-warn" : ""}`}>
            <span>No Inspector Assigned</span>
            <strong>{noInspector}</strong>
            <small>jobs missing inspector</small>
          </div>
        </div>

        {/* Filters */}
        <section className="ps-table-panel">
          <div className="ps-pipeline-filters">
            <input
              className="ps-input"
              type="search"
              placeholder="Search job, client, job #, inspector, DSA status..."
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
            />
            <select className="ps-input" value={subLineFilter} onChange={(e) => setSubLineFilter(e.target.value)}>
              <option value="all">All Lines</option>
              {LINES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select className="ps-input" value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </section>

        {/* Main submittal table */}
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Submittal & Approval Register</h2>
            <span>{filteredSubJobs.length} jobs shown</span>
          </div>
          <div className="ps-pipeline-table-wrap">
            <table className="ps-pipeline-table ps-submittal-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Line</th>
                  <th>Status</th>
                  <th>Contract</th>
                  <th>Submittals Out</th>
                  <th>Submittals Received</th>
                  <th>Aging</th>
                  <th>DSA Status</th>
                  <th>DSA Redlines</th>
                  <th>DSA Approval</th>
                  <th>Inspector</th>
                  <th>Lab</th>
                  <th>Subcontract</th>
                  <th>Open Items</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubJobs.length === 0 && (
                  <tr><td colSpan={14} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>No jobs match filters.</td></tr>
                )}
                {filteredSubJobs.map((j) => {
                  const age = agingDays(j.master?.submittalsOut);
                  const isOverdue = age !== null && !j.master?.submittalsReceived && age > 21;
                  const hasDsaIssue = j.master?.dsaStatus && !j.master?.dsaApproval;
                  return (
                    <tr
                      key={j.id}
                      className={isOverdue || hasDsaIssue ? "ps-submittal-row-warn" : ""}
                      onClick={() => onOpenProduction(j.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <strong>{j.name}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>{j.client}{j.jobNumber ? ` · #${j.jobNumber}` : ""}</small>
                      </td>
                      <td>{j.line}</td>
                      <td><StatusChip status={j.status} /></td>
                      <td>{j.master?.contract || <span className="ps-sub-empty">—</span>}</td>
                      <td>
                        {j.master?.submittalsOut
                          ? <span className="ps-sub-sent">{displayDate(j.master.submittalsOut)}</span>
                          : <span className="ps-sub-empty">Not sent</span>}
                      </td>
                      <td>
                        {j.master?.submittalsReceived
                          ? <span className="ps-sub-received">{displayDate(j.master.submittalsReceived)}</span>
                          : j.master?.submittalsOut
                            ? <span className="ps-sub-pending">Awaiting</span>
                            : <span className="ps-sub-empty">—</span>}
                      </td>
                      <td>
                        {age !== null && !j.master?.submittalsReceived
                          ? <span className={`ps-sub-age${isOverdue ? " is-overdue" : ""}`}>{age}d</span>
                          : <span className="ps-sub-empty">—</span>}
                      </td>
                      <td>{j.master?.dsaStatus || <span className="ps-sub-empty">—</span>}</td>
                      <td>
                        {j.master?.dsaRedlines
                          ? <span className="ps-sub-warn">{displayDate(j.master.dsaRedlines)}</span>
                          : <span className="ps-sub-empty">—</span>}
                      </td>
                      <td>
                        {j.master?.dsaApproval
                          ? <span className="ps-sub-received">{displayDate(j.master.dsaApproval)}</span>
                          : j.master?.dsaStatus
                            ? <span className="ps-sub-pending">Pending</span>
                            : <span className="ps-sub-empty">—</span>}
                      </td>
                      <td>{j.master?.inspector || <span className="ps-sub-empty ps-sub-missing">Unassigned</span>}</td>
                      <td>{j.master?.lab || <span className="ps-sub-empty">—</span>}</td>
                      <td>{j.master?.subcontractStatus || <span className="ps-sub-empty">—</span>}</td>
                      <td>
                        {j.master?.openItems
                          ? <span className="ps-sub-warn" title={j.master.openItems}>⚠ {j.master.openItems.slice(0, 30)}{j.master.openItems.length > 30 ? "…" : ""}</span>
                          : <span className="ps-sub-empty">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Overdue / attention required list */}
        {overdueReview > 0 && (
          <section className="ps-table-panel">
            <div className="ps-section-head">
              <h2>Overdue Submittals (21+ days)</h2>
              <span>Sent but no response received</span>
            </div>
            <div className="ps-compact-list">
              {submittableJobs.filter((j) => {
                const age = agingDays(j.master?.submittalsOut);
                return age !== null && !j.master?.submittalsReceived && age > 21;
              }).map((j) => {
                const age = agingDays(j.master?.submittalsOut);
                return (
                  <button key={j.id} type="button" onClick={() => onOpenProduction(j.id)}>
                    <span className="ps-status-dot is-red" />
                    <strong>{j.name}</strong>
                    <small>{j.client} · Sent {displayDate(j.master.submittalsOut)} · {age} days ago · No response</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Formal Submittals from Supabase */}
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Formal Submittal Log</h2>
            <span>{submittals.length} records</span>
          </div>
          {submittals.length === 0 ? (
            <p style={{ padding: "16px 0", color: "#64748b", fontSize: "0.875rem" }}>
              No formal submittals logged yet. Open a job and add submittals from its detail panel, or use the Supabase dashboard to seed records.
            </p>
          ) : (
            <div className="ps-pipeline-table-wrap">
              <table className="ps-pipeline-table ps-submittal-table">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Rev</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Received</th>
                    <th>Approved</th>
                    <th>Reviewer</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {submittals.map((s) => {
                    const job = jobs.find((j) => j.id === s.jobId);
                    const sentAge = s.sentDate && !s.receivedDate ? agingDays(s.sentDate) : null;
                    const isOverdue = sentAge !== null && sentAge > 21;
                    return (
                      <tr key={s.id} className={isOverdue ? "ps-submittal-row-warn" : ""}>
                        <td>
                          <strong>{job?.name ?? s.jobId}</strong>
                          {job && <small style={{ display: "block", color: "#64748b" }}>{job.client}</small>}
                        </td>
                        <td style={{ textTransform: "capitalize" }}>{s.type}</td>
                        <td>{s.title || <span className="ps-sub-empty">—</span>}</td>
                        <td>Rev {s.revNumber}</td>
                        <td>
                          <span className={`ps-sub-badge ps-sub-${s.status.replace(/_/g, "-")}`}>
                            {s.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>{s.sentDate ? <span className="ps-sub-sent">{displayDate(s.sentDate)}</span> : <span className="ps-sub-empty">—</span>}</td>
                        <td>{s.receivedDate ? <span className="ps-sub-received">{displayDate(s.receivedDate)}</span> : s.sentDate ? <span className="ps-sub-pending">Awaiting</span> : <span className="ps-sub-empty">—</span>}</td>
                        <td>{s.approvedDate ? <span className="ps-sub-received">{displayDate(s.approvedDate)}</span> : <span className="ps-sub-empty">—</span>}</td>
                        <td>{s.reviewer || <span className="ps-sub-empty">—</span>}</td>
                        <td style={{ maxWidth: 200 }}>{s.notes ? <span title={s.notes}>{s.notes.slice(0, 40)}{s.notes.length > 40 ? "…" : ""}</span> : <span className="ps-sub-empty">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    );
  }

  if (module.id === "projects") {
    const activeJobs = jobs.filter((j) => j.status !== "complete" && j.status !== "forecast");

    const filteredActiveJobs = activeJobs.filter((j) => {
      const matchLine = apLineFilter === "all" || j.line === apLineFilter;
      const matchStatus = apStatusFilter === "all" || j.status === apStatusFilter;
      const hay = `${j.name} ${j.client} ${j.jobNumber || ""} ${j.pm || ""}`.toLowerCase();
      const matchSearch = !apSearch.trim() || hay.includes(apSearch.trim().toLowerCase());
      return matchLine && matchStatus && matchSearch;
    });

    function toggleRow(id) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }

    function toggleAll() {
      setSelectedRows((prev) =>
        prev.size === filteredActiveJobs.length ? new Set() : new Set(filteredActiveJobs.map((j) => j.id))
      );
    }

    function applyBatchShift() {
      const days = parseInt(batchShiftDays, 10);
      if (!days || !selectedRows.size) return;
      selectedRows.forEach((id) => {
        const job = jobs.find((j) => j.id === id);
        if (!job) return;
        updateJob(id, {
          start: addDays(job.start, days),
          offLine: addDays(job.offLine, days),
          end: addDays(job.end, days),
          due: addDays(job.due, days),
        });
      });
      setSelectedRows(new Set());
      setBatchShiftDays("");
      setShowBatchShift(false);
    }

    const statusOptions = Object.entries(STATUS_CONFIG).map(([value, v]) => ({ value, label: v.label }));

    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Daily standup · click any cell to edit" />

        {/* Filters + batch actions */}
        <section className="ps-table-panel">
          <div className="ps-pipeline-filters">
            <input
              className="ps-input"
              type="search"
              placeholder="Search job, client, PM, job #…"
              value={apSearch}
              onChange={(e) => setApSearch(e.target.value)}
            />
            <select className="ps-input" value={apStatusFilter} onChange={(e) => setApStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="ps-input" value={apLineFilter} onChange={(e) => setApLineFilter(e.target.value)}>
              <option value="all">All Lines</option>
              {LINES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {selectedRows.size > 0 && (
              <button
                type="button"
                className="ps-input"
                style={{ background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa", fontWeight: 600, cursor: "pointer" }}
                onClick={() => setShowBatchShift((v) => !v)}
              >
                {selectedRows.size} selected · Shift dates
              </button>
            )}
          </div>
          {showBatchShift && selectedRows.size > 0 && (
            <div className="ps-batch-shift">
              <span>Shift all {selectedRows.size} selected jobs by</span>
              <input
                type="number"
                className="ps-input"
                style={{ width: 80 }}
                value={batchShiftDays}
                onChange={(e) => setBatchShiftDays(e.target.value)}
                placeholder="days"
              />
              <span>days (negative = earlier)</span>
              <button type="button" className="ps-login-submit" style={{ padding: "6px 16px", fontSize: "0.875rem" }} onClick={applyBatchShift}>
                Apply
              </button>
              <button type="button" onClick={() => setShowBatchShift(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>Cancel</button>
            </div>
          )}
        </section>

        {/* Main inline-edit table */}
        <section className="ps-table-panel" style={{ overflowX: "auto" }}>
          <div className="ps-section-head">
            <h2>Active Production</h2>
            <span>{filteredActiveJobs.length} jobs · click any cell to edit · Enter or blur to save</span>
          </div>
          <table className="ps-ap-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={selectedRows.size === filteredActiveJobs.length && filteredActiveJobs.length > 0} onChange={toggleAll} />
                </th>
                <th>Job</th>
                <th>PM</th>
                <th>Line</th>
                <th>Status</th>
                <th>Ship Date</th>
                <th>Set Date</th>
                <th>DSA Status</th>
                <th>Subs Out</th>
                <th>Subs Received</th>
                <th>Inspector</th>
                <th>Contract</th>
                <th style={{ minWidth: 220 }}>Open Items</th>
                <th style={{ minWidth: 220 }}>PM Update</th>
              </tr>
            </thead>
            <tbody>
              {filteredActiveJobs.length === 0 && (
                <tr><td colSpan={14} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>No active jobs match filters.</td></tr>
              )}
              {filteredActiveJobs.map((job) => {
                const isSelected = selectedRows.has(job.id);
                const hasOpenItems = Boolean(job.master?.openItems);
                const isLate = job.end && job.end < today;
                return (
                  <tr
                    key={job.id}
                    className={`ps-ap-row${isSelected ? " is-selected" : ""}${isLate ? " is-late" : ""}${hasOpenItems ? " has-items" : ""}`}
                  >
                    <td>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleRow(job.id)} />
                    </td>
                    <td className="ps-ap-job-cell">
                      <button className="fs-open-btn" onClick={() => onOpenFactSheet?.(job.id)} title="Open fact sheet">
                        <strong>{jobLabel(job)}</strong>
                        <small>{job.client}</small>
                        {(job.procore?.rfiOpenCount > 0 || job.procore?.punchOpenCount > 0 || job.procore?.changeEventCount > 0 || job.procore?.inspectionDeficient > 0) && (
                          <span className="fs-ap-procore-pills">
                            {job.procore?.rfiOpenCount > 0 && (
                              <span className={`fs-ap-pill ${job.procore.rfiOverdueCount > 0 ? "is-red" : "is-orange"}`} title={`${job.procore.rfiOpenCount} open RFI${job.procore.rfiOpenCount !== 1 ? "s" : ""}${job.procore.rfiOverdueCount > 0 ? ` (${job.procore.rfiOverdueCount} overdue)` : ""}`}>
                                RFI {job.procore.rfiOpenCount}
                              </span>
                            )}
                            {job.procore?.punchOpenCount > 0 && (
                              <span className={`fs-ap-pill ${job.procore.punchScheduleImpact > 0 ? "is-red" : "is-orange"}`} title={`${job.procore.punchOpenCount} open punch item${job.procore.punchOpenCount !== 1 ? "s" : ""}${job.procore.punchScheduleImpact > 0 ? ` · ${job.procore.punchScheduleImpact}d schedule impact` : ""}`}>
                                Punch {job.procore.punchOpenCount}
                              </span>
                            )}
                            {job.procore?.changeEventCount > 0 && (
                              <span className="fs-ap-pill is-blue" title={`${job.procore.changeEventCount} open change event${job.procore.changeEventCount !== 1 ? "s" : ""}`}>
                                CE {job.procore.changeEventCount}
                              </span>
                            )}
                            {job.procore?.inspectionDeficient > 0 && (
                              <span className="fs-ap-pill is-red" title={`${job.procore.inspectionDeficient} inspection deficienc${job.procore.inspectionDeficient !== 1 ? "ies" : "y"}`}>
                                ✗ Insp {job.procore.inspectionDeficient}
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </td>
                    <td><EditableCell job={job} field="pm" placeholder="Assign PM" /></td>
                    <td>
                      <EditableCell
                        job={job}
                        field="line"
                        options={[
                          { value: "L1", label: "Line 1" },
                          { value: "L2", label: "Line 2" },
                          { value: "L3", label: "Line 3" },
                          { value: "L4", label: "Line 4" },
                          { value: "QUEUE", label: "Queue" },
                        ]}
                      />
                    </td>
                    <td>
                      <EditableCell job={job} field="status" options={statusOptions} />
                    </td>
                    <td><EditableCell job={job} field="end" type="date" placeholder="Ship date" /></td>
                    <td><EditableCell job={job} field="due" type="date" placeholder="Set date" /></td>
                    <td><EditableCell job={job} field="master.dsaStatus" placeholder="DSA status" /></td>
                    <td><EditableCell job={job} field="master.submittalsOut" type="date" placeholder="Sent" /></td>
                    <td><EditableCell job={job} field="master.submittalsReceived" type="date" placeholder="Received" /></td>
                    <td><EditableCell job={job} field="master.inspector" placeholder="Inspector" /></td>
                    <td><EditableCell job={job} field="master.contract" placeholder="Contract status" /></td>
                    <td>
                      <EditableCell
                        job={job}
                        field="master.openItems"
                        placeholder="No open items"
                      />
                    </td>
                    <td>
                      <EditableCell
                        job={job}
                        field="master.pmUpdate"
                        placeholder="Add update…"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </section>
    );
  }

  if (module.id === "reports") {
    const reports = [
      { name: "Executive Operating Summary", owner: "Leadership", cadence: "Weekly", metric: `${kpis.jobs} jobs` },
      { name: "Sales Forecast to Capacity", owner: "Sales + Plant", cadence: "Weekly", metric: formatProtectedMoney(pipelineRows.reduce((sum, row) => sum + row.weighted, 0), canViewPrices) },
      { name: "Production Readiness Exceptions", owner: "Operations", cadence: "Daily", metric: `${bridgeGaps.length} gaps` },
      { name: "Ship and Set Lookahead", owner: "Project Management", cadence: "Daily", metric: `${jobs.filter((job) => job.end <= addDays(formatDate(new Date()), 60)).length} upcoming` },
    ];
    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Reusable reporting" />
        <div className="ps-report-grid">
          {reports.map((report) => (
            <section key={report.name} className="ps-report-card">
              <strong>{report.name}</strong>
              <span>{report.owner}</span>
              <div><b>{report.metric}</b><em>{report.cadence}</em></div>
            </section>
          ))}
        </div>
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Current Exception Feed</h2>
            <span>Used by dashboard, reports, and project reviews</span>
          </div>
          <div className="ps-compact-list">
            {bridgeGaps.map(({ job, integration, readiness }) => (
              <button key={job.id} type="button" onClick={() => onOpenProduction(job.id)}>
                <strong>{integration.label}</strong>
                <span>{jobLabel(job)}</span>
                <small>{readiness}% readiness - {job.notes || "No note entered"}</small>
              </button>
            ))}
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="ps-module-page" aria-label={module.title}>
      <ModuleHead module={module} eyebrow="System configuration" />
      <div className="ps-settings-grid">
        <SettingsPanel
          title="Integration Map"
          rows={[
            ["NetSuite", "Customer, contract, job number, revenue", excelSync.connected ? "Connected" : "Needs connector"],
            ["SCM Hub", "Schedule, line, readiness, risks", "Active"],
            ["Procore", "Submittals, field dates, inspections, closeout", "Planned"],
          ]}
        />
        <SettingsPanel
          title="Production Lines"
          rows={LINES.map((line) => [line.name, line.focus, `${lineUtilization.find((item) => item.line === line.id)?.modules || 0} modules`])}
        />
        <SettingsPanel
          title="Status Workflow"
          rows={Object.entries(STATUS_CONFIG).map(([key, value]) => [value.label, key, "Enabled"])}
        />
        {userAdmin.canManage && (
          <section className="ps-table-panel">
            <div className="ps-section-head">
              <h2>User Profiles</h2>
              <span>Manage role and pricing access</span>
            </div>
            {!isSupabaseEnabled ? (
              <p className="ps-empty">Supabase is not configured. Add env vars to enable profile management.</p>
            ) : (
              <UserProfilesAdmin userAdmin={userAdmin} />
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function UserProfilesAdmin({ userAdmin }) {
  const [draft, setDraft] = useState({
    id: "",
    email: "",
    full_name: "",
    role: "User",
    can_view_prices: false,
  });
  const [status, setStatus] = useState("");

  async function submitProfile(event) {
    event.preventDefault();
    const result = await userAdmin.saveProfile(draft);
    if (!result.ok) {
      setStatus(result.error || "Save failed.");
      return;
    }
    setStatus("Profile saved.");
    setDraft({ id: "", email: "", full_name: "", role: "User", can_view_prices: false });
  }

  function editProfile(profile) {
    setDraft({
      id: profile.id || "",
      email: profile.email || "",
      full_name: profile.full_name || "",
      role: profile.role || "User",
      can_view_prices: Boolean(profile.can_view_prices),
    });
    setStatus(`Editing ${profile.email || profile.id}`);
  }

  async function removeProfile(id) {
    const result = await userAdmin.deleteProfile(id);
    setStatus(result.ok ? "Profile deleted." : (result.error || "Delete failed."));
  }

  return (
    <div className="ps-user-admin">
      <form className="ps-user-form" onSubmit={submitProfile}>
        <input className="ps-input" placeholder="Auth User ID (UUID)" value={draft.id} onChange={(e) => setDraft((v) => ({ ...v, id: e.target.value }))} />
        <input className="ps-input" placeholder="Email" value={draft.email} onChange={(e) => setDraft((v) => ({ ...v, email: e.target.value }))} />
        <input className="ps-input" placeholder="Full name" value={draft.full_name} onChange={(e) => setDraft((v) => ({ ...v, full_name: e.target.value }))} />
        <input className="ps-input" placeholder="Role" value={draft.role} onChange={(e) => setDraft((v) => ({ ...v, role: e.target.value }))} />
        <label className="ps-user-checkbox">
          <input type="checkbox" checked={draft.can_view_prices} onChange={(e) => setDraft((v) => ({ ...v, can_view_prices: e.target.checked }))} />
          Pricing access
        </label>
        <Button>{draft.id ? "Save Profile" : "Add Profile"}</Button>
      </form>
      <p className="ps-empty">Use the Auth user UUID from Supabase Authentication. This updates `public.user_profiles` in Supabase.</p>
      {status && <p className="ps-empty">{status}</p>}
      {userAdmin.error && <p className="ps-login-error">{userAdmin.error}</p>}
      {userAdmin.loading ? <p className="ps-empty">Loading profiles...</p> : (
        <div className="ps-project-table">
          <div className="ps-project-row is-header">
            <span>Email</span><span>User ID</span><span>Role</span><span>Pricing</span><span>Actions</span>
          </div>
          {userAdmin.profiles.map((profile) => (
            <div key={profile.id} className="ps-project-row">
              <span><strong>{profile.email || "-"}</strong><small>{profile.full_name || "No name"}</small></span>
              <span><small>{profile.id}</small></span>
              <span><small>{profile.role || "User"}</small></span>
              <span><small>{profile.can_view_prices ? "Enabled" : "Hidden"}</small></span>
              <span>
                <button type="button" className="ps-mini-btn" onClick={() => editProfile(profile)}>Edit</button>
                <button type="button" className="ps-mini-btn ps-mini-btn-danger" onClick={() => removeProfile(profile.id)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleHead({ module, eyebrow }) {
  return (
    <div className="ps-module-head">
      <div>
        <p className="ps-eyebrow">{eyebrow}</p>
        <h2>{module.title}</h2>
        <span>{module.description}</span>
      </div>
    </div>
  );
}

function MetricBlock({ label, value, detail }) {
  return (
    <div className="ps-metric-block">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function SettingsPanel({ title, rows }) {
  return (
    <section className="ps-table-panel">
      <div className="ps-section-head">
        <h2>{title}</h2>
      </div>
      <div className="ps-settings-list">
        {rows.map(([name, detail, status]) => (
          <div key={`${title}-${name}`}>
            <strong>{name}</strong>
            <span>{detail}</span>
            <small>{status}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function readinessScore(job) {
  const values = Object.values(job.readiness);
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

function getPriorityWeight(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "critical") return 40;
  if (value === "high") return 30;
  if (value === "medium") return 20;
  return 10;
}

function getQueueReadinessBucket(score) {
  if (score >= 85) return { label: "Ready now", tone: "green" };
  if (score >= 55) return { label: "Ready with risks", tone: "amber" };
  return { label: "Blocked", tone: "red" };
}

function queueUrgencyPoints(job, today) {
  const daysUntilDue = diffDays(toDate(today), toDate(job.due));
  if (daysUntilDue <= 7) return 30;
  if (daysUntilDue <= 21) return 20;
  if (daysUntilDue <= 45) return 12;
  return 6;
}

function queueRiskPenalty(job) {
  let penalty = 0;
  if (job.status === "hold") penalty += 20;
  if (job.status === "delayed") penalty += 24;
  return penalty;
}

function displayDate(dateStr) {
  if (!dateStr) return "Not set";
  const d = toDate(dateStr);
  if (Number.isNaN(d.valueOf())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dateFieldHelp(job) {
  if (job?.sourceType === "master") {
    return {
      start: "Excel column: Topset Date",
      offLine: "Assumed Topset Date + 30 days",
      end: "Excel column: Shipping Date",
      due: "Excel column: Set Date",
    };
  }
  return {
    start: "Production work begins",
    offLine: "Assumed 30 days after Topset Date",
    end: "Planned ship date",
    due: "Site set or customer need date",
  };
}

// ── Procore stat card (used in ProcoreLiveTab) ────────────────────────────────
function ProcoreStatCard({ label, value, sub, tone }) {
  const palettes = {
    red:    { bg: "#fef2f2", text: "#dc2626", border: "#fee2e2" },
    orange: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
    green:  { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
    blue:   { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
    gray:   { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
  };
  const { bg, text, border } = palettes[tone] ?? palettes.gray;
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: text }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: text, lineHeight: 1 }}>{value ?? "—"}</span>
      {sub && <span style={{ fontSize: 12, color: text, opacity: .75 }}>{sub}</span>}
    </div>
  );
}

// ── Procore Live tab content ───────────────────────────────────────────────────
function ProcoreLiveTab({ job, syncing, setSyncing, syncResult, setSyncResult, updateJob }) {
  const p = job.procore ?? {};
  const hasData = p.rfiOpenCount || p.punchOpenCount || p.changeEventCount ||
    p.inspectionDeficient || p.observationOpenCount || p.primeContractExecuted || p.subcontractExecuted;

  async function pullFromProcore() {
    if (!job.jobNumber) { setSyncResult({ error: "No job number set on this job." }); return; }
    setSyncing(true);
    setSyncResult(null);
    try {
      // Use supabaseClient.functions.invoke — handles auth + CORS automatically
      const { data, error } = await supabaseClient.functions.invoke("procore-sync", {
        body: { job_number: job.jobNumber },
      });
      if (error) throw error;
      setSyncResult(data);
      if (data?.ok) setTimeout(() => window.location.reload(), 1400);
    } catch (e) {
      setSyncResult({ error: e.message ?? String(e) });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="fs-section-grid">
      <div className="fs-field-group fs-full">
        <div className="fs-section-head" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Procore Connection <ProcoreBadge tooltip="All data on this tab is synced from Procore via webhook or manual pull" />
          </span>
          <button onClick={pullFromProcore} disabled={syncing}
            style={{ fontSize: 12, padding: "5px 14px", borderRadius: 7, border: "1px solid #e55a2b", background: syncing ? "#f3f4f6" : "#fff4f0", color: "#e55a2b", fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer" }}>
            {syncing ? "⟳ Pulling…" : "⬇ Pull from Procore"}
          </button>
        </div>

        {syncResult && (
          <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: syncResult.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${syncResult.ok ? "#bbf7d0" : "#fecaca"}`,
            color: syncResult.ok ? "#15803d" : "#dc2626" }}>
            {syncResult.ok ? (
              <>✓ Synced from <strong>{syncResult.procore_project?.name}</strong> — {syncResult.synced?.submittals} submittals · {syncResult.synced?.rfis} RFIs · {syncResult.synced?.punches} punch items · {syncResult.synced?.changeEvents} change events · {syncResult.synced?.inspections} inspections · {syncResult.synced?.observations} observations <span style={{ color: "#6b7280" }}>Refreshing…</span></>
            ) : <>✗ {syncResult.error}</>}
          </div>
        )}

        <label className="fs-label">Procore Project ID
          <input className="fs-input" type="number" value={p.projectId ?? ""}
            placeholder="Enter Procore project ID (optional — job number match is automatic)"
            onChange={(e) => updateJob({ procore_project_id: e.target.value ? Number(e.target.value) : null })} />
          <small style={{ color: "#9ca3af", marginTop: 2 }}>Webhooks auto-match by job number first. Set this only if job numbers differ.</small>
        </label>
      </div>

      {!hasData ? (
        <div className="fs-field-group fs-full">
          <p style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>
            No Procore data synced yet. Click <strong>⬇ Pull from Procore</strong> to import all existing RFIs, submittals, punch items, inspections, and more.
          </p>
        </div>
      ) : (
        <>
          <div className="fs-field-group fs-full">
            <div className="fs-section-head">Live Counters</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              <ProcoreStatCard label="Open RFIs" value={p.rfiOpenCount}
                sub={p.rfiOverdueCount > 0 ? `${p.rfiOverdueCount} overdue` : "none overdue"}
                tone={p.rfiOverdueCount > 0 ? "red" : p.rfiOpenCount > 0 ? "orange" : "green"} />
              <ProcoreStatCard label="Punch Items" value={p.punchOpenCount}
                sub={p.punchScheduleImpact > 0 ? `${p.punchScheduleImpact}d schedule impact` : "no impact"}
                tone={p.punchScheduleImpact > 0 ? "red" : p.punchOpenCount > 0 ? "orange" : "green"} />
              <ProcoreStatCard label="Change Events" value={p.changeEventCount}
                sub="open / pending" tone={p.changeEventCount > 0 ? "orange" : "green"} />
              <ProcoreStatCard label="Insp. Deficiencies" value={p.inspectionDeficient}
                sub="failing items" tone={p.inspectionDeficient > 0 ? "red" : "green"} />
              <ProcoreStatCard label="Observations" value={p.observationOpenCount}
                sub="open items" tone={p.observationOpenCount > 0 ? "orange" : "green"} />
            </div>
          </div>

          <div className="fs-field-group fs-full">
            <div className="fs-section-head">Contract Status <ProcoreBadge tooltip="Synced from Procore prime contract and work order contract webhooks" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Prime Contract", done: p.primeContractExecuted, date: p.primeContractDate, amount: null },
                { label: "Subcontract",    done: p.subcontractExecuted,   date: p.subcontractDate,   amount: p.subcontractAmount },
              ].map(({ label, done, date, amount }) => (
                <div key={label} style={{ background: done ? "#f0fdf4" : "#fef9f0", border: `1px solid ${done ? "#bbf7d0" : "#fde68a"}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: done ? "#16a34a" : "#92400e", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: done ? "#16a34a" : "#92400e" }}>{done ? "✓ Executed" : "Not Executed"}</div>
                  {amount && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>${Number(amount).toLocaleString()}</div>}
                  {date && <div style={{ fontSize: 12, color: "#6b7280" }}>Signed {date}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Procore sync badge ────────────────────────────────────────────────────────
function ProcoreBadge({ tooltip }) {
  return (
    <span className="fs-procore-badge" title={tooltip || "This field is automatically updated by Procore via webhook"}>
      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#e55a2b" />
        <text x="10" y="14" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="sans-serif">P</text>
      </svg>
      Procore
    </span>
  );
}

// ── Job Fact Sheet (full slide-over drawer) ──────────────────────────────────
const FS_TABS = [
  { id: "overview",    label: "Overview" },
  { id: "schedule",   label: "Schedule" },
  { id: "dsa",        label: "DSA & Submittals" },
  { id: "production", label: "Production" },
  { id: "procore",    label: "Procore Live" },
  { id: "financials", label: "Financials" },
  { id: "activity",   label: "Activity" },
  { id: "notes",      label: "Notes" },
];

function JobFactSheet({ job, onClose, updateJob, updateMasterField }) {
  const [tab, setTab] = useState("overview");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (tab !== "activity" || !supabaseClient || !job?.id) return;
    setActivityLoading(true);
    supabaseClient
      .from("activity_log")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setActivityLog(data || []);
        setActivityLoading(false);
      });
  }, [tab, job?.id]);

  if (!job) return null;
  const u = (patch) => updateJob(job.id, patch);
  const m = (field, val) => updateMasterField(job.id, field, val);
  const dateHelp = dateFieldHelp(job);

  return (
    <div className="fs-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="fs-drawer" role="dialog" aria-label={`Fact Sheet: ${job.name}`}>

        {/* Header */}
        <div className="fs-header">
          <div className="fs-header-left">
            <h2 className="fs-title">{jobLabel(job)}</h2>
            <span className="fs-client">{job.client}</span>
          </div>
          <div className="fs-header-right">
            <StatusChip status={job.status} />
            <button className="fs-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="fs-tabs" role="tablist">
          {FS_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={`fs-tab${tab === t.id ? " is-active" : ""}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="fs-body">

          {/* ── Overview ── */}
          {tab === "overview" && (
            <div className="fs-section-grid">
              <div className="fs-field-group">
                <label className="fs-label">Project Name
                  <input className="fs-input" value={job.name} onChange={(e) => u({ name: e.target.value })} />
                </label>
                <label className="fs-label">Job Number
                  <input className="fs-input" value={job.jobNumber || ""} onChange={(e) => u({ jobNumber: e.target.value })} />
                </label>
                <label className="fs-label">Client / District
                  <input className="fs-input" value={job.client || ""} onChange={(e) => u({ client: e.target.value })} />
                </label>
                <label className="fs-label">Project Manager
                  <input className="fs-input" value={job.pm || ""} placeholder="e.g. Joe/Rod" onChange={(e) => u({ pm: e.target.value })} />
                </label>
              </div>
              <div className="fs-field-group">
                <label className="fs-label">Status
                  <select className="fs-input" value={job.status} onChange={(e) => u({ status: e.target.value })}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
                <label className="fs-label">Line
                  <select className="fs-input" value={job.line} onChange={(e) => u({ line: e.target.value })}>
                    {LINES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    <option value={QUEUE}>Queue</option>
                  </select>
                </label>
                <label className="fs-label">Priority
                  <select className="fs-input" value={job.priority} onChange={(e) => u({ priority: e.target.value })}>
                    {["Low","Medium","High","Critical"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="fs-label">Progress %
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="fs-input" type="number" min="0" max="100" value={job.progress}
                      onChange={(e) => u({ progress: Number(e.target.value) })} style={{ width: 80 }} />
                    <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 99 }}>
                      <div style={{ width: `${job.progress}%`, height: "100%", background: "#f97316", borderRadius: 99, transition: "width .3s" }} />
                    </div>
                  </div>
                </label>
              </div>
              <div className="fs-field-group fs-full">
                <label className="fs-label">Modules
                  <input className="fs-input" type="number" min="1" value={job.modules} style={{ width: 100 }}
                    onChange={(e) => u({ modules: Number(e.target.value) })} />
                </label>
                <label className="fs-label">Crew Size
                  <input className="fs-input" type="number" min="1" value={job.crew} style={{ width: 100 }}
                    onChange={(e) => u({ crew: Number(e.target.value) })} />
                </label>
                <label className="fs-label">Bar Color
                  <input className="fs-input" type="color" value={job.color} style={{ width: 60, padding: 2, height: 36 }}
                    onChange={(e) => u({ color: e.target.value })} />
                </label>
              </div>
            </div>
          )}

          {/* ── Schedule ── */}
          {tab === "schedule" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Production Timeline</div>
                <div className="fs-date-row">
                  <label className="fs-label">Topset Date <small>{dateHelp.start}</small>
                    <input className="fs-input" type="date" value={job.start}
                      onChange={(e) => u({ start: e.target.value })} />
                  </label>
                  <label className="fs-label">Topset Complete <small>{dateHelp.offLine}</small>
                    <input className="fs-input" type="date" value={job.offLine || defaultTopsetCompleteDate(job.start)}
                      onChange={(e) => u({ offLine: e.target.value })} />
                  </label>
                  <label className="fs-label">Ship Date <small>{dateHelp.end}</small>
                    <input className="fs-input" type="date" value={job.end}
                      onChange={(e) => u({ end: e.target.value })} />
                  </label>
                  <label className="fs-label">Set Date <small>{dateHelp.due}</small>
                    <input className="fs-input" type="date" value={job.due}
                      onChange={(e) => u({ due: e.target.value })} />
                  </label>
                </div>
                <div className="fs-date-stats">
                  <div><strong>{dateDiffDays(job.start, job.end)}</strong><span>factory days</span></div>
                  <div>
                    <strong>{job.end > job.due
                      ? `${dateDiffDays(job.due, job.end)}d late`
                      : `${dateDiffDays(job.end, job.due)}d buffer`}</strong>
                    <span>ship → set</span>
                  </div>
                  <div><strong>{job.modules}</strong><span>modules</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── DSA & Submittals ── */}
          {tab === "dsa" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Contract & Submittals</div>
                <label className="fs-label">Contract
                  <textarea className="fs-input fs-textarea" value={job.master?.contract || ""}
                    onChange={(e) => m("contract", e.target.value)} />
                </label>
                <div className="fs-two-col">
                  <label className="fs-label">
                    <span className="fs-label-row">Submittals Out <ProcoreBadge tooltip="Set by Procore when a submittal is sent (submitted_at)" /></span>
                    <input className="fs-input" type="date" value={job.master?.submittalsOut || ""}
                      onChange={(e) => m("submittalsOut", e.target.value)} />
                  </label>
                  <label className="fs-label">
                    <span className="fs-label-row">Submittals Received <ProcoreBadge tooltip="Set by Procore when a submittal is returned (received_at)" /></span>
                    <input className="fs-input" type="date" value={job.master?.submittalsReceived || ""}
                      onChange={(e) => m("submittalsReceived", e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">DSA Review</div>
                <div className="fs-two-col">
                  <label className="fs-label">
                    <span className="fs-label-row">DSA Status <ProcoreBadge tooltip="Updated by Procore when submittal status changes (approved, under_review, revise_and_resubmit, etc.)" /></span>
                    <input className="fs-input" value={job.master?.dsaStatus || ""}
                      placeholder="e.g. Approved, Under Review"
                      onChange={(e) => m("dsaStatus", e.target.value)} />
                  </label>
                  <label className="fs-label">
                    <span className="fs-label-row">Est. DSA Approval Date <ProcoreBadge tooltip="Set by Procore when submittal is approved (approved_at)" /></span>
                    <input className="fs-input" type="date" value={job.master?.dsaApproval || ""}
                      onChange={(e) => m("dsaApproval", e.target.value)} />
                  </label>
                </div>
                <label className="fs-label">DSA Redlines
                  <textarea className="fs-input fs-textarea" value={job.master?.dsaRedlines || ""}
                    onChange={(e) => m("dsaRedlines", e.target.value)} />
                </label>
                <div className="fs-two-col">
                  <label className="fs-label">Inspector
                    <input className="fs-input" value={job.master?.inspector || ""}
                      onChange={(e) => m("inspector", e.target.value)} />
                  </label>
                  <label className="fs-label">Lab
                    <input className="fs-input" value={job.master?.lab || ""}
                      onChange={(e) => m("lab", e.target.value)} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Production ── */}
          {tab === "production" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Factory Status</div>
                <div className="fs-two-col">
                  <label className="fs-label">Job Card
                    <input className="fs-input" value={job.master?.jobCard || ""}
                      onChange={(e) => m("jobCard", e.target.value)} />
                  </label>
                  <label className="fs-label">Factory Subcontract Status
                    <input className="fs-input" value={job.master?.subcontractStatus || ""}
                      onChange={(e) => m("subcontractStatus", e.target.value)} />
                  </label>
                </div>
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Production Readiness</div>
                <div className="fs-readiness-grid">
                  {[["drawings","Drawings / Plans"],["materials","Materials"],["permits","Permits"],["inspections","QA / Inspections"]].map(([key, lbl]) => (
                    <label key={key} className="fs-check-label">
                      <input type="checkbox" checked={job.readiness?.[key] ?? false}
                        onChange={(e) => u({ readiness: { ...job.readiness, [key]: e.target.checked } })} />
                      <span className={job.readiness?.[key] ? "fs-check-done" : ""}>{lbl}</span>
                    </label>
                  ))}
                </div>
                <div className="fs-readiness-bar">
                  {["drawings","materials","permits","inspections"].map((k) => (
                    <div key={k} className={`fs-ready-pip ${job.readiness?.[k] ? "is-done" : ""}`} title={k} />
                  ))}
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {Object.values(job.readiness || {}).filter(Boolean).length}/4 ready
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Procore Live ── */}
          {tab === "procore" && (
            <ProcoreLiveTab
              job={job}
              syncing={syncing}
              setSyncing={setSyncing}
              syncResult={syncResult}
              setSyncResult={setSyncResult}
              updateJob={u}
            />
          )}

          {/* ── Financials ── */}
          {tab === "financials" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Prime Contract</div>
                <div className="fs-two-col">
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">Contract Executed</span>
                    <span className="fs-stat-val">{job.procore?.primeContractExecuted ? "Yes" : "Pending"}</span>
                    {job.procore?.primeContractDate && <span className="fs-stat-sub">{displayDate(job.procore.primeContractDate)}</span>}
                  </div>
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">Contract Notes</span>
                    <textarea className="fs-input fs-textarea" style={{ minHeight: 64 }} value={job.master?.contract || ""}
                      onChange={(e) => m("contract", e.target.value)} placeholder="Contract terms, notes…" />
                  </div>
                </div>
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Subcontract</div>
                <div className="fs-two-col">
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">Subcontract Executed</span>
                    <span className="fs-stat-val">{job.procore?.subcontractExecuted ? "Yes" : "Pending"}</span>
                    {job.procore?.subcontractDate && <span className="fs-stat-sub">{displayDate(job.procore.subcontractDate)}</span>}
                  </div>
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">Subcontract Amount</span>
                    <span className="fs-stat-val fs-stat-green">
                      {job.procore?.subcontractAmount != null
                        ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(job.procore.subcontractAmount)
                        : "—"}
                    </span>
                  </div>
                </div>
                <label className="fs-label" style={{ marginTop: 8 }}>Subcontract Status (notes)
                  <input className="fs-input" value={job.master?.subcontractStatus || ""}
                    onChange={(e) => m("subcontractStatus", e.target.value)} placeholder="e.g. Executed, Pending signature…" />
                </label>
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Change Events</div>
                <div className="fs-two-col">
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">Open Change Events</span>
                    <span className="fs-stat-val">{job.procore?.changeEventCount ?? 0}</span>
                  </div>
                  <div className="fs-stat-box">
                    <span className="fs-stat-label">RFIs Open / Overdue</span>
                    <span className="fs-stat-val">{job.procore?.rfiOpenCount ?? 0} / <span style={{ color: "#b91c1c" }}>{job.procore?.rfiOverdueCount ?? 0}</span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === "activity" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Job Activity Log</div>
                {activityLoading ? (
                  <p className="fs-empty-msg">Loading…</p>
                ) : activityLog.length === 0 ? (
                  <p className="fs-empty-msg">No activity recorded for this job yet.</p>
                ) : (
                  <div className="fs-activity-list">
                    {activityLog.map((entry) => (
                      <div key={entry.id} className="fs-activity-row">
                        <div className="fs-activity-meta">
                          <span className="fs-activity-action">{entry.action || "update"}</span>
                          <span className="fs-activity-ts">{entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}</span>
                          {entry.user_name && <span className="fs-activity-user">{entry.user_name}</span>}
                        </div>
                        {entry.detail && <div className="fs-activity-detail">{entry.detail}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="fs-section-grid">
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">Open Items</div>
                <textarea className="fs-input fs-textarea fs-textarea-lg"
                  value={job.master?.openItems || ""}
                  placeholder="List open items, blockers, action items…"
                  onChange={(e) => m("openItems", e.target.value)} />
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  PM Update <ProcoreBadge tooltip="Procore daily log entries are automatically appended here with a date stamp" />
                </div>
                <textarea className="fs-input fs-textarea fs-textarea-lg"
                  value={job.master?.pmUpdate || ""}
                  placeholder="Latest PM update / site notes…"
                  onChange={(e) => m("pmUpdate", e.target.value)} />
              </div>
              <div className="fs-field-group fs-full">
                <div className="fs-section-head">General Notes</div>
                <textarea className="fs-input fs-textarea"
                  value={job.notes || ""}
                  placeholder="Any other notes…"
                  onChange={(e) => u({ notes: e.target.value })} />
              </div>
            </div>
          )}

        </div>
      </aside>
    </div>
  );
}

// ── Calendar View ───────────────────────────────────────────────────────────
const CAL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function jobActiveOnDate(job, dateStr) {
  return job.start <= dateStr && dateStr <= job.end && job.line !== "QUEUE";
}

function CalendarView({ jobs, today, onSelectJob }) {
  const [calMode, setCalMode] = useState("week"); // "week" | "month"
  const [anchor, setAnchor] = useState(() => {
    const d = toDate(today);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - dow);
    return formatDate(d);
  });

  function weekStart(dateStr) {
    const d = toDate(dateStr);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return formatDate(d);
  }

  function monthStart(dateStr) {
    const d = toDate(dateStr);
    return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  function navWeek(delta) {
    setAnchor((a) => addDays(a, delta * 7));
  }
  function navMonth(delta) {
    const d = toDate(anchor);
    d.setMonth(d.getMonth() + delta);
    d.setDate(1);
    setAnchor(formatDate(d));
  }
  function goToday() {
    setAnchor(calMode === "week" ? weekStart(today) : monthStart(today));
  }

  if (calMode === "week") {
    const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const anchorDate = toDate(anchor);
    const label = `${CAL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    return (
      <div className="cal-root">
        <div className="cal-toolbar">
          <button type="button" onClick={() => navWeek(-1)}>‹</button>
          <strong>{label}</strong>
          <button type="button" onClick={() => navWeek(1)}>›</button>
          <button type="button" className="cal-today-btn" onClick={goToday}>Today</button>
          <div className="cal-mode-tabs">
            <button type="button" className="is-active">Week</button>
            <button type="button" onClick={() => { setCalMode("month"); setAnchor(monthStart(anchor)); }}>Month</button>
          </div>
        </div>
        <div className="cal-week-grid">
          <div className="cal-week-header">
            <div className="cal-week-corner" />
            {days.map((d) => {
              const dt = toDate(d);
              const isToday = d === today;
              return (
                <div key={d} className={`cal-week-day-head${isToday ? " is-today" : ""}`}>
                  <span>{CAL_DAYS[(dt.getDay() + 6) % 7]}</span>
                  <strong>{dt.getDate()}</strong>
                </div>
              );
            })}
          </div>
          {LINES.map((line) => {
            const lineJobs = jobs.filter((j) => j.line === line.id);
            return (
              <div key={line.id} className="cal-week-row">
                <div className="cal-week-line-label">
                  <strong>{line.name}</strong>
                  <small>{line.focus}</small>
                </div>
                {days.map((d) => {
                  const active = lineJobs.filter((j) => jobActiveOnDate(j, d));
                  const isToday = d === today;
                  return (
                    <div key={d} className={`cal-week-cell${isToday ? " is-today" : ""}`}>
                      {active.map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          className="cal-job-chip"
                          style={{ background: job.color }}
                          title={`${jobLabel(job)} — ${job.client}`}
                          onClick={() => onSelectJob(job.id)}
                        >
                          {job.jobNumber && <span className="cal-chip-num">{job.jobNumber}</span>}
                          <span className="cal-chip-name">{job.name.length > 14 ? job.name.slice(0, 13) + "…" : job.name}</span>
                        </button>
                      ))}
                      {active.length === 0 && <span className="cal-cell-empty" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Month view
  const anchorDate = toDate(anchor);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstDow = (firstDay.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const gridStart = formatDate(new Date(year, month, 1 - firstDow));
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));

  return (
    <div className="cal-root">
      <div className="cal-toolbar">
        <button type="button" onClick={() => navMonth(-1)}>‹</button>
        <strong>{CAL_MONTHS[month]} {year}</strong>
        <button type="button" onClick={() => navMonth(1)}>›</button>
        <button type="button" className="cal-today-btn" onClick={goToday}>Today</button>
        <div className="cal-mode-tabs">
          <button type="button" onClick={() => { setCalMode("week"); setAnchor(weekStart(anchor)); }}>Week</button>
          <button type="button" className="is-active">Month</button>
        </div>
      </div>
      <div className="cal-month-grid">
        {CAL_DAYS.map((d) => <div key={d} className="cal-month-dow">{d}</div>)}
        {cells.map((d) => {
          const inMonth = toDate(d).getMonth() === month;
          const isToday = d === today;
          const active = jobs.filter((j) => jobActiveOnDate(j, d) && j.line !== "QUEUE");
          return (
            <div key={d} className={`cal-month-cell${inMonth ? "" : " out-of-month"}${isToday ? " is-today" : ""}`}>
              <span className="cal-month-cell-date">{toDate(d).getDate()}</span>
              {active.slice(0, 3).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className="cal-job-chip cal-job-chip-sm"
                  style={{ background: job.color }}
                  title={`${jobLabel(job)} · ${job.line}`}
                  onClick={() => onSelectJob(job.id)}
                >
                  {job.jobNumber && <span className="cal-chip-num">{job.jobNumber}</span>}
                  <span className="cal-chip-name">{job.name.length > 12 ? job.name.slice(0, 11) + "…" : job.name}</span>
                </button>
              ))}
              {active.length > 3 && (
                <span className="cal-more-badge">+{active.length - 3} more</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dispatch Board ───────────────────────────────────────────────────────────
function DispatchBoard({ jobs, today, updateJob, updateMasterField, onSelectJob }) {
  const [dispatchDate, setDispatchDate] = useState(today);

  const activeByLine = useMemo(() => {
    const result = {};
    for (const line of LINES) {
      result[line.id] = jobs.filter((j) => j.line === line.id && jobActiveOnDate(j, dispatchDate));
    }
    return result;
  }, [jobs, dispatchDate]);

  const totalCrew = LINES.reduce((sum, l) => sum + (activeByLine[l.id] || []).reduce((s, j) => s + (j.crew || 0), 0), 0);
  const totalModules = LINES.reduce((sum, l) => sum + (activeByLine[l.id] || []).reduce((s, j) => s + (j.modules || 0), 0), 0);
  const activeLineCount = LINES.filter((l) => (activeByLine[l.id] || []).length > 0).length;

  const dispDt = toDate(dispatchDate);
  const dispLabel = `${CAL_DAYS[(dispDt.getDay() + 6) % 7]}, ${CAL_MONTHS[dispDt.getMonth()]} ${dispDt.getDate()}, ${dispDt.getFullYear()}`;

  return (
    <div className="db-root">
      <div className="db-toolbar">
        <button type="button" onClick={() => setDispatchDate((d) => addDays(d, -1))}>‹ Prev</button>
        <div className="db-date-block">
          <strong>{dispLabel}</strong>
          {dispatchDate === today && <span className="db-today-badge">Today</span>}
        </div>
        <button type="button" onClick={() => setDispatchDate((d) => addDays(d, 1))}>Next ›</button>
        <button type="button" className="db-jump-today" onClick={() => setDispatchDate(today)}>Jump to Today</button>
        <input type="date" className="db-date-input" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
      </div>

      <div className="db-summary-bar">
        <div className="db-sum-kpi"><span>{activeLineCount}</span><label>Lines active</label></div>
        <div className="db-sum-kpi"><span>{totalCrew}</span><label>Crew on site</label></div>
        <div className="db-sum-kpi"><span>{totalModules}</span><label>Modules in production</label></div>
      </div>

      <div className="db-board">
        {LINES.map((line) => {
          const lineJobs = activeByLine[line.id] || [];
          const isEmpty = lineJobs.length === 0;
          return (
            <div key={line.id} className={`db-line-card${isEmpty ? " db-line-idle" : ""}`}>
              <div className="db-line-head">
                <div>
                  <strong>{line.name}</strong>
                  <small>{line.focus}</small>
                </div>
                {!isEmpty && (
                  <span className="db-line-crew-badge">{lineJobs.reduce((s, j) => s + (j.crew || 0), 0)} crew</span>
                )}
                {isEmpty && <span className="db-idle-badge">Idle</span>}
              </div>
              {isEmpty && (
                <p className="db-idle-msg">No jobs scheduled for this line today.</p>
              )}
              {lineJobs.map((job) => {
                const readyCount = Object.values(job.readiness || {}).filter(Boolean).length;
                const daysLeft = Math.round((toDate(job.end) - toDate(dispatchDate)) / MS_PER_DAY);
                return (
                  <div key={job.id} className="db-job-block">
                    <div className="db-job-color-bar" style={{ background: job.color }} />
                    <div className="db-job-body">
                      <div className="db-job-title-row">
                        <button type="button" className="db-job-name" onClick={() => onSelectJob(job.id)}>
                          {jobLabel(job)}
                        </button>
                        <span className={`ps-status-chip is-${job.status}`}>{STATUS_CONFIG[job.status]?.label || job.status}</span>
                      </div>
                      <div className="db-job-client">{job.client}</div>

                      <div className="db-job-meta">
                        <span>{job.modules} modules</span>
                        <span>{job.crew} crew</span>
                        <span className={daysLeft < 0 ? "db-late" : daysLeft <= 5 ? "db-warn" : ""}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d to ship`}
                        </span>
                        {job.pm && <span>PM: {job.pm}</span>}
                      </div>

                      <div className="db-progress-row">
                        <div className="db-progress-bar">
                          <div className="db-progress-fill" style={{ width: `${job.progress}%`, background: job.color }} />
                        </div>
                        <span>{job.progress}%</span>
                      </div>

                      <div className="db-readiness-row">
                        {[["drawings","Plans"],["materials","Materials"],["permits","Permits"],["inspections","QA"]].map(([key, lbl]) => (
                          <label key={key} className={`db-ready-chip${job.readiness?.[key] ? " is-done" : ""}`}>
                            <input type="checkbox" checked={Boolean(job.readiness?.[key])}
                              onChange={(e) => updateJob(job.id, { readiness: { ...job.readiness, [key]: e.target.checked } })} />
                            {lbl}
                          </label>
                        ))}
                        <span className="db-ready-count">{readyCount}/4</span>
                      </div>

                      {(job.master?.openItems || job.master?.pmUpdate) && (
                        <div className="db-notes-preview">
                          {job.master?.pmUpdate && <p><strong>PM:</strong> {job.master.pmUpdate.slice(0, 120)}{job.master.pmUpdate.length > 120 ? "…" : ""}</p>}
                          {job.master?.openItems && <p><strong>Open:</strong> {job.master.openItems.slice(0, 100)}{job.master.openItems.length > 100 ? "…" : ""}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week tick data for the timeline header ──────────────────────────────────
function buildWeekTicks(dayPx, timelineStart, timelineEnd) {
  const ticks = [];
  const cursor = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);

  while (cursor <= timelineEnd) {
    for (let week = 0; week < 4; week += 1) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), 1 + week * 7);
      if (date < timelineStart || date > timelineEnd) continue;

      const dayOffset = diffDays(timelineStart, date);
      ticks.push({ x: dayOffset * dayPx, label: `W${week + 1}` });
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return ticks;
}

export default function ProductionScheduler({
  currentUser,
  permissions,
  onLogout,
  initialModule = "dashboard",
  embedded = false,
  activeModule: activeModuleProp,
  onModuleChange,
}) {
  const {
    jobs,
    setJobs: persistJobs,
    setJobsBulk,
    loading: dbLoading,
    dbError,
    refresh: dbRefresh,
    isSupabase,
  } = useJobs(SAMPLE_JOBS, normalizeJob);
  const {
    deals: pipelineDeals,
    setDeals: setPipelineDeals,
    setDealsBulk: setPipelineDealsBulk,
  } = usePipelineDeals(SAMPLE_PIPELINE_DEALS);
  const { submittals, saveSubmittal, removeSubmittal } = useSubmittals();
  const userProfiles = useUserProfiles();

  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [draggedQueueJobId, setDraggedQueueJobId] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [summaryList, setSummaryList] = useState(null);
  const [activeModuleInternal, setActiveModuleInternal] = useState(initialModule);
  const activeModule = activeModuleProp !== undefined ? activeModuleProp : activeModuleInternal;
  const setActiveModule = (mod) => {
    if (activeModuleProp === undefined) setActiveModuleInternal(mod);
    if (onModuleChange) onModuleChange(mod);
  };
  const [scheduleView, setScheduleView] = useState("production");
  const [factSheetId, setFactSheetId] = useState(null);
  const [dayPx, setDayPx] = useState(4);
  const [scheduleLayoutView, setScheduleLayoutView] = useState("gantt"); // "gantt" | "calendar" | "dispatch"
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationJobs, setSimulationJobs] = useState(null);
  const [excelSync, setExcelSync] = useState({
    connected: false,
    busy: false,
    lastSyncedAt: "",
    message: "Excel sync not connected",
  });
  const canViewPrices = Boolean(permissions?.canViewPrices);
  const canManageUsers = String(currentUser?.email || "").toLowerCase() === "michael@webbinvestments.com";
  const gridRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);
  const jobsRef = useRef(jobs);

  const today = formatDate(new Date());
  const workingJobs = simulationMode ? (simulationJobs || jobs) : jobs;
  const setJobs = useCallback((updaterOrValue) => {
    if (simulationMode) {
      setSimulationJobs((current) => {
        const base = current || jobs;
        return typeof updaterOrValue === "function" ? updaterOrValue(base) : updaterOrValue;
      });
      return;
    }
    persistJobs(updaterOrValue);
  }, [jobs, persistJobs, simulationMode]);
  const timelineRange = useMemo(() => {
    const validDates = [today, ...workingJobs.flatMap((job) => {
      const dates = getMilestoneDates(job);
      return [dates.start, dates.offLine, dates.end, dates.due];
    })]
      .map((dateStr) => toDate(dateStr))
      .filter((date) => !Number.isNaN(date.valueOf()));

    const minDate = validDates.length ? new Date(Math.min(...validDates)) : new Date(FALLBACK_YEAR, 0, 1);
    const maxDate = validDates.length ? new Date(Math.max(...validDates)) : new Date(FALLBACK_YEAR, 11, 31);
    const start = new Date(minDate.getFullYear() - 1, 0, 1);
    const end = new Date(maxDate.getFullYear() + 1, 11, 31);

    return {
      start,
      end,
      startYear: start.getFullYear(),
      endYear: end.getFullYear(),
      totalDays: diffDays(start, end) + 1,
    };
  }, [today, workingJobs]);
  const { totalDays } = timelineRange;
  const totalWidth = totalDays * dayPx;

  // ── Auto-scroll to today on mount and when returning to Production ───────
  useEffect(() => {
    if (activeModule !== "production") return;
    if (!gridRef.current) return;
    const dayOffset = diffDays(timelineRange.start, toDate(today));
    const todayPx = dayOffset * dayPx;
    // Center today in the visible area, offset by ~200px for context
    const containerW = gridRef.current.clientWidth;
    gridRef.current.scrollLeft = Math.max(0, todayPx - containerW / 2 + 100);
  }, [activeModule, dayPx, timelineRange.start, today]);

  // All unique PM names, split from "Joe/Rod" style entries
  const allPMs = useMemo(() => {
    const names = new Set();
    workingJobs.forEach((j) => {
      if (j.pm) j.pm.split(/[/,&]+/).map((s) => s.trim()).filter(Boolean).forEach((n) => names.add(n));
    });
    return [...names].sort();
  }, [workingJobs]);

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workingJobs.filter((job) => {
      const matchesText = !term || `${job.name} ${job.client} ${job.notes} ${job.pm || ""}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesLine = lineFilter === "all" || job.line === lineFilter;
      const matchesPm = pmFilter === "all" || (job.pm || "").toLowerCase().includes(pmFilter.toLowerCase());
      return matchesText && matchesStatus && matchesLine && matchesPm;
    });
  }, [lineFilter, pmFilter, search, statusFilter, workingJobs]);

  const scheduledJobs = visibleJobs.filter((job) => LINE_IDS.includes(job.line));
  const queuedJobs = visibleJobs.filter((job) => job.line === QUEUE);
  const selectedJob = workingJobs.find((job) => job.id === selectedId) || null;
  const selectedDateHelp = dateFieldHelp(selectedJob);

  useEffect(() => {
    jobsRef.current = workingJobs;
  }, [workingJobs]);

  useEffect(() => {
    dragRef.current = dragging;
  }, [dragging]);

  const monthTicks = useMemo(
    () => {
      const ticks = [];
      let x = 0;
      for (let year = timelineRange.startYear; year <= timelineRange.endYear; year += 1) {
        for (let month = 0; month < 12; month += 1) {
          const width = daysInMonth(year, month) * dayPx;
          ticks.push({
            label: `${MONTHS[month]} ${year}`,
            x,
            width,
            isJanuary: month === 0,
          });
          x += width;
        }
      }
      return ticks;
    },
    [dayPx, timelineRange.endYear, timelineRange.startYear],
  );

  // Week ticks — only show label when there's enough space (>=28px apart)
  const weekTicks = useMemo(() => {
    const ticks = buildWeekTicks(dayPx, timelineRange.start, timelineRange.end);
    const minGap = 28;
    return ticks.filter((_t, i) => {
      if (i === 0) return true;
      return (ticks[i].x - ticks[i - 1].x) >= minGap;
    });
  }, [dayPx, timelineRange.end, timelineRange.start]);

  const todayX = useMemo(() => {
    const diff = diffDays(timelineRange.start, toDate(today));
    if (diff < 0 || diff > totalDays) return null;
    return clamp(diff, 0, totalDays - 1) * dayPx;
  }, [dayPx, today, timelineRange.start, totalDays]);

  const overlaps = useMemo(() => {
    const result = [];
    for (const line of LINE_IDS) {
      const lineJobs = workingJobs.filter((j) => j.line === line);
      for (let i = 0; i < lineJobs.length; i++) {
        for (let k = i + 1; k < lineJobs.length; k++) {
          const a = lineJobs[i];
          const b = lineJobs[k];
          const aRange = getTrackRange(a, scheduleView);
          const bRange = getTrackRange(b, scheduleView);
          if (rangesOverlap(aRange.start, aRange.end, bRange.start, bRange.end)) {
            result.push({
              line,
              start: aRange.start > bRange.start ? aRange.start : bRange.start,
              end: aRange.end < bRange.end ? aRange.end : bRange.end,
              jobs: [a.id, b.id],
              names: [a.name, b.name],
            });
          }
        }
      }
    }
    return result;
  }, [scheduleView, workingJobs]);

  const lineUtilization = useMemo(
    () =>
      LINE_IDS.map((line) => {
        const lineJobs = workingJobs.filter((j) => j.line === line);
        const usedDays = lineJobs.reduce((sum, j) => {
          const range = getTrackRange(j, scheduleView);
          return sum + dateDiffDays(range.start, range.end);
        }, 0);
        const modules = lineJobs.reduce((sum, j) => sum + j.modules, 0);
        return {
          line,
          utilization: Math.min(100, Math.round((usedDays / totalDays) * 100)),
          modules,
          jobs: lineJobs.length,
        };
      }),
    [scheduleView, totalDays, workingJobs],
  );

  const risks = useMemo(() => {
    const riskList = [];
    workingJobs.forEach((job) => {
      if (LINE_IDS.includes(job.line) && job.end > job.due) {
        riskList.push({ type: "Late", job, detail: `${dateDiffDays(job.due, job.end)} days past set date` });
      }
      if (job.status === "hold" || job.status === "delayed") {
        riskList.push({ type: job.status === "hold" ? "Hold" : "Delay", job, detail: job.notes || "Needs review" });
      }
      if (readinessScore(job) < 75 && job.status !== "forecast") {
        riskList.push({ type: "Readiness", job, detail: `${readinessScore(job)}% production-ready` });
      }
    });
    overlaps.forEach((o) => {
      riskList.push({ type: "Overlap", detail: `${o.line}: ${o.names.join(" / ")}`, job: null });
    });
    return riskList.slice(0, 8);
  }, [overlaps, workingJobs]);

  const kpis = useMemo(() => {
    const scheduled = workingJobs.filter((j) => LINE_IDS.includes(j.line));
    const totalModules = workingJobs.reduce((sum, j) => sum + j.modules, 0);
    const avgReadiness = Math.round(workingJobs.reduce((sum, j) => sum + readinessScore(j), 0) / Math.max(1, workingJobs.length));
    return {
      jobs: workingJobs.length,
      modules: totalModules,
      production: workingJobs.filter((j) => j.status === "production").length,
      queued: workingJobs.filter((j) => j.line === QUEUE).length,
      readiness: `${avgReadiness}%`,
      utilization: `${Math.round(scheduled.reduce((sum, j) => sum + dateDiffDays(j.start, j.end), 0) / (totalDays * LINE_IDS.length) * 100)}%`,
    };
  }, [totalDays, workingJobs]);

  const summaryJobs = useMemo(() => {
    if (!summaryList) return [];

    if (summaryList === "production") return workingJobs.filter((j) => j.status === "production");
    if (summaryList === "queued") return workingJobs.filter((j) => j.line === QUEUE);
    if (summaryList === "jobs") return workingJobs;
    if (summaryList === "readiness") return workingJobs.filter((j) => readinessScore(j) < 100);

    return [];
  }, [summaryList, workingJobs]);

  const queuedRankedJobs = useMemo(() => {
    return queuedJobs
      .map((job) => {
        const readiness = readinessScore(job);
        const score = getPriorityWeight(job.priority) + queueUrgencyPoints(job, today) + readiness - queueRiskPenalty(job);
        return {
          ...job,
          queueScore: score,
          readiness,
          queueBucket: getQueueReadinessBucket(readiness),
        };
      })
      .sort((a, b) => b.queueScore - a.queueScore);
  }, [queuedJobs, today]);

  const bestLineByQueueJob = useMemo(() => {
    const result = {};
    queuedRankedJobs.forEach((job) => {
      const rankedLines = LINE_IDS.map((line) => {
        const lineJobs = workingJobs.filter((j) => j.line === line);
        const overlapCount = lineJobs.filter((j) => rangesOverlap(job.start, job.end, j.start, j.end)).length;
        const utilization = lineUtilization.find((u) => u.line === line)?.utilization || 0;
        return { line, score: overlapCount * 100 + utilization };
      }).sort((a, b) => a.score - b.score);
      result[job.id] = rankedLines[0]?.line || "L1";
    });
    return result;
  }, [lineUtilization, queuedRankedJobs, workingJobs]);

  const baselineKpis = useMemo(() => {
    const scheduled = jobs.filter((j) => LINE_IDS.includes(j.line));
    const totalModules = jobs.reduce((sum, j) => sum + j.modules, 0);
    const avgReadiness = Math.round(jobs.reduce((sum, j) => sum + readinessScore(j), 0) / Math.max(1, jobs.length));
    return {
      jobs: jobs.length,
      modules: totalModules,
      production: jobs.filter((j) => j.status === "production").length,
      queued: jobs.filter((j) => j.line === QUEUE).length,
      readiness: avgReadiness,
      utilization: Math.round(scheduled.reduce((sum, j) => sum + dateDiffDays(j.start, j.end), 0) / (totalDays * LINE_IDS.length) * 100),
      overlapCount: (() => {
        let count = 0;
        for (const line of LINE_IDS) {
          const lineJobs = jobs.filter((j) => j.line === line);
          for (let i = 0; i < lineJobs.length; i += 1) {
            for (let k = i + 1; k < lineJobs.length; k += 1) {
              if (rangesOverlap(lineJobs[i].start, lineJobs[i].end, lineJobs[k].start, lineJobs[k].end)) count += 1;
            }
          }
        }
        return count;
      })(),
      lateCount: jobs.filter((j) => LINE_IDS.includes(j.line) && j.end > j.due).length,
    };
  }, [jobs, totalDays]);

  const summaryTitle = {
    jobs: "All Jobs",
    production: "In Production",
    queued: "Queued Jobs",
    readiness: "Readiness Items",
  }[summaryList];
  const activeModuleConfig = NAV_ITEMS.find((item) => item.id === activeModule) || NAV_ITEMS[1];

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const syncFromExcel = useCallback(async ({ quiet = false } = {}) => {
    setExcelSync((c) => ({ ...c, busy: true, message: "Reading Excel..." }));
    try {
      const res = await fetch(`${EXCEL_API_URL}/api/jobs`);
      const payload = await readExcelApiJson(res);
      if (!res.ok) throw new Error(payload.error || "Excel sync failed");
      const imported = payload.jobs.map(normalizeJob);
      setJobsBulk(imported);          // single bulk upsert → Supabase
      setSelectedId(imported[0]?.id || null);
      setExcelSync({ connected: true, busy: false, lastSyncedAt: payload.syncedAt, message: `Loaded ${imported.length} jobs from master Excel` });
      if (!quiet) showToast("Synced from Excel");
    } catch (err) {
      setExcelSync({
        connected: false, busy: false, lastSyncedAt: "",
        message: err.message.includes("fetch") ? "Start Excel sync server with npm run dev:excel" : err.message,
      });
      if (!quiet) showToast("Excel sync unavailable");
    }
  }, [showToast]);

  const syncFromSalesExcel = useCallback(async ({ quiet = false } = {}) => {
    setExcelSync((c) => ({ ...c, busy: true, message: "Reading sales pipeline Excel..." }));
    try {
      const res = await fetch(`${EXCEL_API_URL}/api/pipeline`);
      const payload = await readExcelApiJson(res);
      if (!res.ok) throw new Error(payload.error || "Sales pipeline sync failed");
      const imported = (payload.deals || []).map((deal, index) => ({
        id: deal.id || `deal-import-${index}`,
        opportunityName: deal.opportunityName || deal.name || "Opportunity",
        client: deal.client || "",
        stage: deal.stage || "lead",
        probability: Number(deal.probability) || 15,
        amount: Number(deal.amount) || 0,
        weightedAmount: Number(deal.weightedAmount) || 0,
        expectedCloseDate: deal.expectedCloseDate || "",
        estimator: deal.estimator || "",
        projectManager: deal.projectManager || "",
        notes: deal.notes || "",
        sourceType: deal.sourceType || "sales_excel",
        sourceSheet: deal.sourceSheet || "",
        sourceRow: deal.sourceRow || null,
      }));
      setPipelineDealsBulk(imported);
      setExcelSync({ connected: true, busy: false, lastSyncedAt: payload.syncedAt, message: `Loaded ${imported.length} deals from sales Excel` });
      if (!quiet) showToast("Synced sales pipeline from Excel");
    } catch (err) {
      setExcelSync({
        connected: false, busy: false, lastSyncedAt: "",
        message: err.message.includes("fetch") ? "Start Excel sync server with npm run dev:excel" : err.message,
      });
      if (!quiet) showToast("Sales pipeline sync unavailable");
    }
  }, [setPipelineDealsBulk, showToast]);

  useEffect(() => {
    const t = window.setTimeout(() => syncFromExcel({ quiet: true }), 0);
    return () => window.clearTimeout(t);
  }, [syncFromExcel]);

  async function saveToExcel() {
    setExcelSync((c) => ({ ...c, busy: true, message: "Saving Excel..." }));
    try {
      const latestJobs = jobsRef.current;
      const res = await fetch(`${EXCEL_API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: latestJobs }),
      });
      const payload = await readExcelApiJson(res);
      if (!res.ok) throw new Error(payload.error || "Excel save failed");
      setExcelSync({ connected: true, busy: false, lastSyncedAt: payload.syncedAt, message: `Saved ${payload.saved} jobs to Excel` });
      showToast("Saved to Excel");
    } catch (err) {
      setExcelSync({
        connected: false, busy: false, lastSyncedAt: "",
        message: err.message.includes("fetch") ? "Start Excel sync server with npm run dev:excel" : err.message,
      });
      showToast("Excel save failed");
    }
  }

  async function savePipelineToExcel() {
    setExcelSync((c) => ({ ...c, busy: true, message: "Saving sales pipeline Excel..." }));
    try {
      const res = await fetch(`${EXCEL_API_URL}/api/pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deals: pipelineDeals }),
      });
      const payload = await readExcelApiJson(res);
      if (!res.ok) throw new Error(payload.error || "Sales pipeline save failed");
      setExcelSync({ connected: true, busy: false, lastSyncedAt: payload.syncedAt, message: `Saved ${payload.saved} deals to sales Excel` });
      showToast("Saved sales pipeline to Excel");
    } catch (err) {
      setExcelSync({
        connected: false, busy: false, lastSyncedAt: "",
        message: err.message.includes("fetch") ? "Start Excel sync server with npm run dev:excel" : err.message,
      });
      showToast("Sales pipeline save failed");
    }
  }

  function updateMasterField(id, field, value) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== id) return job;
        const master = { ...job.master, [field]: value };
        const notes =
          field === "openItems" || field === "pmUpdate"
            ? [master.openItems, master.pmUpdate].filter(Boolean).join("\n\nPM Update: ")
            : job.notes;
        return { ...job, master, notes };
      }),
    );
  }

  function dateToX(dateStr) {
    const diff = diffDays(timelineRange.start, toDate(dateStr));
    return clamp(diff, 0, totalDays - 1) * dayPx;
  }

  const xToDate = useCallback((x) => {
    const days = clamp(Math.round(x / dayPx), 0, totalDays - 1);
    return formatDate(new Date(timelineRange.start.getTime() + days * MS_PER_DAY));
  }, [dayPx, timelineRange.start, totalDays]);

  const getX = useCallback((clientX) => {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    return clamp(clientX - rect.left + gridRef.current.scrollLeft, 0, totalWidth - 1);
  }, [totalWidth]);

  function getLineFromY(clientY) {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const y = clientY - rect.top - HEADER_H;
    const index = Math.floor(y / ROW_H);
    return index >= 0 && index < LINE_IDS.length ? LINE_IDS[index] : null;
  }

  function updateJob(id, patch) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== id) return job;
        const next = { ...job, ...patch };
        if (next.end < next.start) next.end = next.start;
        if (!next.offLine || next.offLine < next.start || patch.start) next.offLine = defaultTopsetCompleteDate(next.start);
        if (next.due < next.start) next.due = next.end;
        return next;
      }),
    );
  }

  function addJob(line = "L1") {
    const job = normalizeJob(
      {
        id: String(nextId++),
        name: "New School Project",
        client: "School District",
        line,
        start: "2026-08-03",
        offLine: "2026-09-02",
        end: "2026-08-28",
        due: "2026-09-04",
        color: JOB_COLORS[nextId % JOB_COLORS.length],
        status: line === QUEUE ? "forecast" : "approved",
        modules: 12,
        crew: 10,
        priority: "Medium",
        notes: "",
      },
      nextId,
    );
    setJobs((c) => [...c, job]);
    setSelectedId(job.id);
    showToast("Job added");
  }

  function duplicateSelected() {
    if (!selectedJob) return;
    const start = addDays(selectedJob.end, 7);
    const duration = dateDiffDays(selectedJob.start, selectedJob.end) - 1;
    const copy = normalizeJob(
      {
        ...selectedJob,
        id: String(nextId++),
        name: `${selectedJob.name} Copy`,
        start,
        offLine: defaultTopsetCompleteDate(start),
        end: addDays(start, duration),
        due: addDays(selectedJob.due, 14),
      },
      nextId,
    );
    setJobs((c) => [...c, copy]);
    setSelectedId(copy.id);
    showToast("Job duplicated");
  }

  function deleteSelected() {
    if (!selectedJob) return;
    setJobs((c) => c.filter((j) => j.id !== selectedJob.id));
    setSelectedId(null);
    showToast("Job deleted");
  }

  function addJobFromDeal(deal) {
    const closeDate = deal.expectedCloseDate || addDays(today, 60);
    const startDate = addDays(closeDate, 14);
    const newId = String(nextId++);
    const job = normalizeJob(
      {
        id: newId,
        name: deal.opportunityName || "New School Project",
        client: deal.client || "School District",
        line: "L1",
        start: startDate,
        offLine: addDays(startDate, 30),
        end: addDays(startDate, 45),
        due: addDays(startDate, 60),
        color: JOB_COLORS[nextId % JOB_COLORS.length],
        status: "approved",
        modules: deal.modules || 12,
        crew: 10,
        priority: "High",
        notes: `Converted from pipeline deal. ${deal.notes || ""}`.trim(),
        sourceDealId: deal.id,
      },
      nextId,
    );
    setJobs((c) => [...c, job]);
    // Mark deal as converted
    setPipelineDeals((c) =>
      c.map((d) =>
        d.id === deal.id
          ? { ...d, stage: "handoff", convertedJobId: newId, convertedAt: today }
          : d,
      ),
    );
    logActivity("deal", deal.id, "converted_to_job", { jobId: newId }, currentUser);
    logActivity("job", newId, "created_from_deal", { dealId: deal.id }, currentUser);
    setSelectedId(job.id);
    setActiveModule("production");
    showToast(`Job created from "${deal.opportunityName || "deal"}"`);
  }

  function scrollToToday() {
    if (!gridRef.current) return;
    const dayOffset = diffDays(timelineRange.start, toDate(today));
    const todayPx = dayOffset * dayPx;
    const containerW = gridRef.current.clientWidth;
    gridRef.current.scrollTo({ left: Math.max(0, todayPx - containerW / 2 + 100), behavior: "smooth" });
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = parseCSV(ev.target.result).map(csvRowToJob);
        setJobs(imported);
        setSelectedId(imported[0]?.id || null);
        showToast(`Imported ${imported.length} jobs`);
      } catch {
        showToast("Import failed");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function exportCSV() {
    const url = URL.createObjectURL(new Blob([jobsToCSV(workingJobs)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "production_schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }

  function moveQueueJobToLine(jobId, line, droppedStart) {
    setJobs((current) =>
      current.map((job) => {
        if (job.id !== jobId) return job;
        const start = droppedStart || job.start;
        const offLineDelta = diffDays(toDate(job.start), toDate(job.offLine || defaultTopsetCompleteDate(job.start)));
        const endDelta = diffDays(toDate(job.start), toDate(job.end));
        const dueDelta = diffDays(toDate(job.start), toDate(job.due));
        return {
          ...job,
          line,
          start,
          offLine: addDays(start, offLineDelta),
          end: addDays(start, endDelta),
          due: addDays(start, dueDelta),
          status: job.status === "forecast" ? "approved" : job.status,
        };
      }),
    );
  }

  function onTimelineDragOver(e) {
    if (!draggedQueueJobId) return;
    e.preventDefault();
  }

  function onTimelineDrop(e) {
    if (!draggedQueueJobId) return;
    e.preventDefault();
    const line = getLineFromY(e.clientY);
    if (!line) {
      setDraggedQueueJobId(null);
      return;
    }
    const start = xToDate(getX(e.clientX));
    moveQueueJobToLine(draggedQueueJobId, line, start);
    setSelectedId(draggedQueueJobId);
    setDraggedQueueJobId(null);
    showToast(`Queued job moved to ${line}`);
  }

  function onGridMouseDown(e) {
    if (e.button !== 0) return;
    const line = getLineFromY(e.clientY);
    if (!line) return;
    const date = xToDate(getX(e.clientX));
    const hit = workingJobs.find((j) => j.line === line && date >= j.start && date <= j.end);
    if (hit) { setSelectedId(hit.id); return; }
    setSelectedId(null);
    const startX = getX(e.clientX);
    setDrawing({ line, startX, currentX: startX, hasDragged: false });
  }

  function startDrag(e, jobId) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(jobId);
    const job = workingJobs.find((j) => j.id === jobId);
    setDragging({
      jobId,
      type: "move",
      startX: getX(e.clientX),
      startY: e.clientY,
      origStart: job.start,
      origOffLine: job.offLine || defaultTopsetCompleteDate(job.start),
      origEnd: job.end,
      origDue: job.due,
      origLine: job.line,
    });
  }

  function startResize(e, jobId, edge) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(jobId);
    const job = workingJobs.find((j) => j.id === jobId);
    setDragging({
      jobId,
      type: `resize-${edge}`,
      startX: getX(e.clientX),
      origStart: job.start,
      origOffLine: job.offLine || defaultTopsetCompleteDate(job.start),
      origEnd: job.end,
      origDue: job.due,
    });
  }

  useEffect(() => {
    function onMove(e) {
      if (dragRef.current) {
        const drag = dragRef.current;
        const delta = Math.round((getX(e.clientX) - drag.startX) / dayPx);
        setJobs((current) =>
          current.map((job) => {
            if (job.id !== drag.jobId) return job;
            if (drag.type === "resize-left") {
              const rightBoundary = scheduleView === "production"
                ? drag.origOffLine
                : (drag.origOffLine < drag.origEnd ? drag.origOffLine : drag.origEnd);
              const latestAllowedStart = addDays(rightBoundary, -1);
              const start = addDays(drag.origStart, delta);
              const nextStart = start > latestAllowedStart ? latestAllowedStart : start;
              if (scheduleView === "production") {
                return { ...job, start: nextStart };
              }
              return { ...job, start: nextStart, offLine: defaultTopsetCompleteDate(nextStart) };
            }
            if (drag.type === "resize-right") {
              if (scheduleView === "production") {
                const nextOffLine = addDays(drag.origOffLine, delta);
                const minOffLine = addDays(job.start, 1);
                return { ...job, offLine: nextOffLine < minOffLine ? minOffLine : nextOffLine };
              }
              const nextEnd = addDays(drag.origEnd, delta);
              const nextDue = addDays(drag.origDue, delta);
              const minEnd = addDays(job.start, 1);
              if (drag.origDue > drag.origEnd) {
                return { ...job, due: nextDue < minEnd ? minEnd : nextDue };
              }
              return { ...job, end: nextEnd < minEnd ? minEnd : nextEnd };
            }
            const duration = dateDiffDays(drag.origStart, drag.origEnd) - 1;
            const start = addDays(drag.origStart, delta);
            const targetLine = getLineFromY(e.clientY) || drag.origLine;
            return {
              ...job,
              line: targetLine,
              start,
              offLine: addDays(drag.origOffLine, delta),
              end: addDays(start, duration),
              due: addDays(drag.origDue, delta),
            };
          }),
        );
      }
      if (drawing) {
        setDrawing((c) => {
          if (!c) return c;
          const currentX = getX(e.clientX);
          return {
            ...c,
            currentX,
            hasDragged: c.hasDragged || Math.abs(currentX - c.startX) >= MIN_DRAW_PX,
          };
        });
      }
    }
    function onUp() {
      if (dragRef.current) { setDragging(null); return; }
      if (drawing) {
        const startX = Math.min(drawing.startX, drawing.currentX);
        const endX = Math.max(drawing.startX, drawing.currentX);
        const startDate = xToDate(startX);
        const endDate = xToDate(endX);
        if (!drawing.hasDragged || Math.abs(drawing.currentX - drawing.startX) < MIN_DRAW_PX || startDate === endDate) {
          setDrawing(null);
          return;
        }
        const id = String(nextId++);
        const job = normalizeJob(
          {
            id,
            name: "New School Project",
            client: "School District",
            line: drawing.line,
            start: startDate,
            offLine: defaultTopsetCompleteDate(startDate),
            end: endDate,
            due: addDays(endDate, 7),
            color: JOB_COLORS[nextId % JOB_COLORS.length],
            status: "forecast",
            modules: 12,
            crew: 10,
          },
          nextId,
        );
        setJobs((c) => [...c, job]);
        setSelectedId(id);
        setDrawing(null);
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dayPx, drawing, getX, scheduleView, xToDate]);

  const simulationDelta = useMemo(() => {
    if (!simulationMode) return null;
    return {
      jobs: kpis.jobs - baselineKpis.jobs,
      queued: kpis.queued - baselineKpis.queued,
      utilization: Number.parseInt(kpis.utilization, 10) - baselineKpis.utilization,
      readiness: Number.parseInt(kpis.readiness, 10) - baselineKpis.readiness,
      overlaps: overlaps.length - baselineKpis.overlapCount,
      late: workingJobs.filter((j) => LINE_IDS.includes(j.line) && j.end > j.due).length - baselineKpis.lateCount,
    };
  }, [baselineKpis, kpis, overlaps.length, simulationMode, workingJobs]);

  function toggleSimulationMode() {
    if (simulationMode) {
      setSimulationMode(false);
      setSimulationJobs(null);
      showToast("Simulation discarded");
      return;
    }
    setSimulationJobs(jobs.map((job) => ({ ...job, readiness: { ...job.readiness }, master: { ...job.master } })));
    setSimulationMode(true);
    showToast("Simulation mode on");
  }

  function applySimulation() {
    if (!simulationMode || !simulationJobs) return;
    persistJobs(simulationJobs);
    setSimulationMode(false);
    setSimulationJobs(null);
    showToast("Simulation applied");
  }

  // ── Register contextual toolbar actions (used by AppShell when embedded) ──
  useEffect(() => {
    if (!embedded) return;
    registerAction('addJob', () => addJob('L1'));
    registerAction('addQueueJob', () => addJob(QUEUE));
    registerAction('importCSV', () => fileRef.current?.click());
    registerAction('exportCSV', exportCSV);
    registerAction('syncExcel', syncFromExcel);
    registerAction('saveExcel', saveToExcel);
    registerAction('toggleSimulation', toggleSimulationMode);
    registerAction('applySimulation', applySimulation);
    registerAction('syncSalesExcel', syncFromSalesExcel);
    registerAction('saveSalesExcel', savePipelineToExcel);
    registerAction('openJob', (id) => setFactSheetId(id));
    return () => clearActions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, addJob, exportCSV]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (dbLoading) {
    return (
      <main className={`ps-shell ps-loading-shell${embedded ? " ps-shell-embedded" : ""}`}>
        <div className="ps-loading">
          <div className="ps-loading-spinner" />
          <p>{isSupabase ? "Loading schedule from database…" : "Loading schedule…"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`ps-shell${embedded ? " ps-shell-embedded" : ""}`}>
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      {!embedded && (
      <header className="ps-topbar">
        <div className="ps-brand">
          <div className="ps-brand-mark" aria-hidden="true">
            {/* Silver Creek Modular logo mark — orange geometric diamond */}
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2L36 11.5V28.5L20 38L4 28.5V11.5L20 2Z" fill="#F97316" opacity="0.15"/>
              <path d="M20 6L10 12V24L20 30L30 24V12L20 6Z" fill="#F97316" opacity="0.5"/>
              <path d="M20 11L13 15V23L20 27L27 23V15L20 11Z" fill="#F97316"/>
            </svg>
          </div>
          <div className="ps-brand-text">
            <p className="ps-eyebrow">SCM Hub</p>
            <h1>Silver Creek Modular</h1>
          </div>
        </div>
        <nav className="ps-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeModule === item.id ? "is-active" : ""}
              onClick={() => {
                setActiveModule(item.id);
                setSummaryList(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ps-actions">
          <div className="ps-user-badge">
            <strong>{currentUser?.name || "Signed in"}</strong>
            <span>{canViewPrices ? "Pricing access" : "Pricing hidden"}</span>
          </div>
          <Button tone="quiet" onClick={onLogout}>Log out</Button>
          {activeModule === "production" && (
            <>
              <Button onClick={() => addJob("L1")}>+ Job</Button>
              <Button tone="quiet" onClick={() => addJob(QUEUE)}>+ Queue</Button>
              <Button tone="quiet" onClick={() => fileRef.current?.click()}>Import CSV</Button>
              <Button tone="quiet" onClick={syncFromExcel} disabled={excelSync.busy}>Sync Excel</Button>
              <Button tone="quiet" onClick={saveToExcel} disabled={excelSync.busy}>Save Excel</Button>
              <Button tone={simulationMode ? "dark" : "quiet"} onClick={toggleSimulationMode}>
                {simulationMode ? "Discard Sim" : "Simulate"}
              </Button>
              {simulationMode && <Button onClick={applySimulation}>Apply Sim</Button>}
              <Button tone="dark" onClick={exportCSV}>Export</Button>
            </>
          )}
          {activeModule === "pipeline" && (
            <>
              <Button tone="quiet" onClick={syncFromSalesExcel} disabled={excelSync.busy}>Sync Sales Excel</Button>
              <Button tone="quiet" onClick={savePipelineToExcel} disabled={excelSync.busy}>Save Sales Excel</Button>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="ps-hidden" onChange={onFileChange} />
        </div>
      </header>
      )}

      {embedded && (
        <section className="ps-embedded-actions">
          {activeModule === "production" && (
            <>
              <Button onClick={() => addJob("L1")}>+ Job</Button>
              <Button tone="quiet" onClick={() => addJob(QUEUE)}>+ Queue</Button>
              <Button tone="quiet" onClick={() => fileRef.current?.click()}>Import CSV</Button>
              <Button tone="quiet" onClick={syncFromExcel} disabled={excelSync.busy}>Sync Excel</Button>
              <Button tone="quiet" onClick={saveToExcel} disabled={excelSync.busy}>Save Excel</Button>
              <Button tone={simulationMode ? "dark" : "quiet"} onClick={toggleSimulationMode}>
                {simulationMode ? "Discard Sim" : "Simulate"}
              </Button>
              {simulationMode && <Button onClick={applySimulation}>Apply Sim</Button>}
              <Button tone="dark" onClick={exportCSV}>Export</Button>
            </>
          )}
          {activeModule === "pipeline" && (
            <>
              <Button tone="quiet" onClick={syncFromSalesExcel} disabled={excelSync.busy}>Sync Sales Excel</Button>
              <Button tone="quiet" onClick={savePipelineToExcel} disabled={excelSync.busy}>Save Sales Excel</Button>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="ps-hidden" onChange={onFileChange} />
        </section>
      )}

      {activeModule === "production" ? (
      <>

      {/* ── KPI Bar ─────────────────────────────────────────────────────── */}
      <section className="ps-kpis">
        <Kpi label="Jobs" value={kpis.jobs} sublabel={`${kpis.modules} total modules`} onClick={() => setSummaryList("jobs")} active={summaryList === "jobs"} />
        <Kpi label="In Production" value={kpis.production} sublabel="active line work" tone="green" onClick={() => setSummaryList("production")} active={summaryList === "production"} />
        <Kpi label="Plant Utilization" value={kpis.utilization} sublabel="year view across 4 lines" />
        <Kpi label="Avg. Readiness" value={kpis.readiness} sublabel="drawings, material, permits, QA" onClick={() => setSummaryList("readiness")} active={summaryList === "readiness"} />
        <Kpi label="Queued" value={kpis.queued} sublabel="not assigned to a line" tone="amber" onClick={() => setSummaryList("queued")} active={summaryList === "queued"} />
      </section>

      {summaryList && (
        <section className="ps-summary-list" aria-label={`${summaryTitle} list`}>
          <div className="ps-summary-list-head">
            <div>
              <strong>{summaryTitle}</strong>
              <span>{summaryJobs.length} jobs</span>
            </div>
            <button type="button" onClick={() => setSummaryList(null)}>Close</button>
          </div>
          <div className="ps-summary-items">
            {summaryJobs.length ? (
              summaryJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(job.id);
                    setStatusFilter("all");
                    setLineFilter("all");
                  }}
                >
                  <b>{jobLabel(job)}</b>
                  <span>{job.line} · {STATUS_CONFIG[job.status]?.label || job.status} · Ship {displayDate(job.end)}</span>
                  {summaryList === "readiness" && <small>{readinessScore(job)}% ready</small>}
                </button>
              ))
            ) : (
              <p>No jobs in this summary.</p>
            )}
          </div>
        </section>
      )}

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <section className="ps-controls" aria-label="Schedule controls">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job, district, or note"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
        <select value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="all">All lines</option>
          {LINES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          <option value={QUEUE}>Queue</option>
        </select>
        <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)} title="Filter by Project Manager">
          <option value="all">All PMs</option>
          {allPMs.map((pm) => <option key={pm} value={pm}>{pm}</option>)}
        </select>
        <div className="ps-schedule-tabs" role="group" aria-label="Schedule view">
          {SCHEDULE_VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={scheduleView === view.id ? "is-active" : ""}
              onClick={() => setScheduleView(view.id)}
              title={`Show ${view.label.toLowerCase()} schedule dates`}
            >
              {view.label}
            </button>
          ))}
        </div>
        <div className="ps-layout-tabs" role="group" aria-label="Layout view">
          {[["gantt","Gantt"],["calendar","Calendar"],["dispatch","Dispatch"]].map(([id, label]) => (
            <button key={id} type="button"
              className={scheduleLayoutView === id ? "is-active" : ""}
              onClick={() => setScheduleLayoutView(id)}>
              {label}
            </button>
          ))}
        </div>
        <button className="ps-today-btn" type="button" onClick={scrollToToday} title="Jump to today">
          Today
        </button>
        <label className="ps-zoom">
          Zoom
          <input min="2" max="10" type="range" value={dayPx} onChange={(e) => setDayPx(Number(e.target.value))} />
        </label>
        <div className={`ps-sync-status ${excelSync.connected ? "is-connected" : ""}`}>
          <strong>{excelSync.connected ? "Excel connected" : "Excel offline"}</strong>
          <span>{excelSync.message}</span>
        </div>
        <div className={`ps-sync-status ${isSupabase && !dbError ? "is-connected" : ""}`}>
          <strong>{isSupabase ? (dbError ? "DB error" : "DB live") : "DB offline"}</strong>
          <span>
            {isSupabase
              ? (dbError ? dbError.slice(0, 40) : `${workingJobs.length} jobs ${simulationMode ? "in simulation" : "synced"}`)
              : "Add .env.local to enable"}
          </span>
        </div>
      </section>

      {simulationMode && simulationDelta && (
        <section className="ps-sim-summary" aria-label="Simulation impact summary">
          <strong>Simulation Impact</strong>
          <span>Jobs {simulationDelta.jobs >= 0 ? "+" : ""}{simulationDelta.jobs}</span>
          <span>Queued {simulationDelta.queued >= 0 ? "+" : ""}{simulationDelta.queued}</span>
          <span>Util {simulationDelta.utilization >= 0 ? "+" : ""}{simulationDelta.utilization}%</span>
          <span>Readiness {simulationDelta.readiness >= 0 ? "+" : ""}{simulationDelta.readiness}%</span>
          <span>Overlaps {simulationDelta.overlaps >= 0 ? "+" : ""}{simulationDelta.overlaps}</span>
          <span>Late {simulationDelta.late >= 0 ? "+" : ""}{simulationDelta.late}</span>
        </section>
      )}

      {/* ── Main Workspace ──────────────────────────────────────────────── */}
      {scheduleLayoutView === "calendar" && (
        <CalendarView jobs={visibleJobs} today={today} onSelectJob={(id) => { setSelectedId(id); setScheduleLayoutView("gantt"); }} />
      )}
      {scheduleLayoutView === "dispatch" && (
        <DispatchBoard jobs={visibleJobs} today={today} updateJob={updateJob} updateMasterField={updateMasterField}
          onSelectJob={(id) => { setSelectedId(id); setScheduleLayoutView("gantt"); }} />
      )}
      <div className={`ps-workspace${scheduleLayoutView !== "gantt" ? " ps-workspace-hidden" : ""}`}>
        {/* Gantt Board */}
        <section className="ps-board" aria-label="Four line schedule">
          {/* Line labels (fixed left column) */}
          <div className="ps-line-labels">
            <div className="ps-line-header-spacer" style={{ height: HEADER_H }} />
            {LINES.map((line) => {
              const util = lineUtilization.find((u) => u.line === line.id);
              return (
                <div className="ps-line-label" key={line.id}>
                  <strong>{line.name}</strong>
                  <small>{util.utilization}% used · {util.modules} modules</small>
                  <div className="ps-meter">
                    <i style={{ width: `${util.utilization}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable timeline */}
          <div className="ps-timeline" ref={gridRef} onMouseDown={onGridMouseDown} onDragOver={onTimelineDragOver} onDrop={onTimelineDrop}>
            <div
              className="ps-canvas"
              style={{ width: totalWidth, height: HEADER_H + LINE_IDS.length * ROW_H }}
            >
              {/* Month labels (top row of header) */}
              {monthTicks.map((month) => (
                <div
                  className="ps-month"
                  key={month.label}
                  style={{ left: month.x, width: month.width }}
                >
                  {month.label}
                </div>
              ))}

              {/* Week tick marks (bottom row of header) */}
              {weekTicks.map((tick) => (
                <div
                  className="ps-week-tick"
                  key={tick.x}
                  style={{ left: tick.x }}
                >
                  <span>{tick.label}</span>
                </div>
              ))}

              {/* Today line */}
              {todayX !== null && (
                <div className="ps-today" style={{ left: todayX }} />
              )}

              {/* Row backgrounds */}
              {LINE_IDS.map((line, i) => (
                <div className="ps-row" key={line} style={{ top: HEADER_H + i * ROW_H }} />
              ))}

              {/* Overlap highlights */}
              {scheduleView !== "production" && overlaps.map((o, i) => (
                <div
                  className="ps-overlap"
                  key={`${o.line}-${o.start}-${i}`}
                  style={{
                    top: HEADER_H + LINE_IDS.indexOf(o.line) * ROW_H + 12,
                    left: dateToX(o.start),
                    width: dateDiffDays(o.start, o.end) * dayPx,
                  }}
                />
              ))}

              {/* Drawing preview */}
              {drawing?.hasDragged && (
                <div
                  className="ps-drawing"
                  style={{
                    top: HEADER_H + LINE_IDS.indexOf(drawing.line) * ROW_H + 16,
                    left: Math.min(drawing.startX, drawing.currentX),
                    width: Math.max(8, Math.abs(drawing.currentX - drawing.startX)),
                  }}
                />
              )}

              {/* Job blocks */}
              {scheduledJobs.map((job) => {
                const lineIndex = LINE_IDS.indexOf(job.line);
                const hasOverlap = overlaps.some((o) => o.jobs.includes(job.id));
                const late = job.end > job.due;
                const layout = getMilestoneLayout(job, scheduleView);
                const showFollowOnDates = scheduleView !== "production";
                const width = Math.max(30, dateDiffDays(layout.trackRange.start, layout.trackRange.end) * dayPx);
                const scheduleWidth = `${Math.max(4, layout.schedulePct)}%`;
                const shipShadeLeft = `${Math.min(layout.offLinePct, layout.shipPct)}%`;
                const shipShadeWidth = `${Math.abs(layout.shipPct - layout.offLinePct)}%`;
                const setShadeLeft = `${Math.min(layout.shipPct, layout.setPct)}%`;
                const setShadeWidth = `${Math.abs(layout.setPct - layout.shipPct)}%`;
                return (
                  <div
                    className={`ps-job ${selectedId === job.id ? "is-selected" : ""} ${hasOverlap ? "has-overlap" : ""}`}
                    key={job.id}
                    style={{
                      top: HEADER_H + lineIndex * ROW_H + 16,
                      left: dateToX(layout.trackRange.start),
                      width,
                    }}
                    title={`${jobLabel(job)}\n${layout.view.endLabel} view\nTopset: ${displayDate(layout.dates.start)}\nTopset Complete: ${displayDate(layout.dates.offLine)}\nShipping: ${displayDate(layout.dates.end)}\nSet: ${displayDate(layout.dates.due)}\n${job.modules} modules\n\nDouble-click to open fact sheet`}
                    onMouseDown={(e) => startDrag(e, job.id)}
                    onDoubleClick={() => setFactSheetId(job.id)}
                  >
                    {showFollowOnDates && (
                      <>
                        <i
                          className="ps-job-shade ps-job-shade-ship"
                          style={{ left: shipShadeLeft, width: shipShadeWidth, background: layout.shippingShade }}
                          title={`Shipping: ${displayDate(layout.dates.end)}`}
                        />
                        <i
                          className="ps-job-shade ps-job-shade-set"
                          style={{ left: setShadeLeft, width: setShadeWidth, background: layout.setShade }}
                          title={`Set: ${displayDate(layout.dates.due)}`}
                        />
                      </>
                    )}
                    <i
                      className="ps-job-core"
                      style={{ width: scheduleWidth, background: layout.coreBackground }}
                    />
                    <button
                      aria-label={`Resize ${job.name} start date`}
                      className="ps-job-resize ps-job-resize-left"
                      type="button"
                      onMouseDown={(e) => startResize(e, job.id, "left")}
                    />
                    <button
                      aria-label={`Resize ${job.name} end date`}
                      className="ps-job-resize ps-job-resize-right"
                      type="button"
                      onMouseDown={(e) => startResize(e, job.id, "right")}
                    />
                    <i className="ps-date-line ps-date-line-topset" style={{ left: "0%" }} title={`Topset: ${displayDate(layout.dates.start)}`} />
                    <i className="ps-date-line ps-date-line-offline" style={{ left: `${layout.offLinePct}%` }} title={`Topset Complete: ${displayDate(layout.dates.offLine)}`}>
                      <span>Topset Complete</span>
                    </i>
                    {showFollowOnDates && (
                      <>
                        <i className="ps-date-line ps-date-line-ship" style={{ left: `${layout.shipPct}%` }} title={`Ship: ${displayDate(layout.dates.end)}`}>
                          <span>Shipping</span>
                        </i>
                        <i className="ps-date-line ps-date-line-set" style={{ left: `${layout.setPct}%` }} title={`Set: ${displayDate(layout.dates.due)}`}>
                          <span>Set</span>
                        </i>
                      </>
                    )}
                    <span>{jobLabel(job)}</span>
                    <small>{job.client || "No client"}{job.pm ? <> · <em className="ps-job-pm">{job.pm}</em></> : null}</small>
                    <b style={{ width: `${job.progress}%` }} />
                    {dragging?.jobId === job.id && (
                      <div className="ps-drag-impact">
                        <span>{Math.max(0, dateDiffDays(job.due, job.end))}d late</span>
                        <span>{overlaps.filter((o) => o.jobs.includes(job.id)).length} overlaps</span>
                        <span>{readinessScore(job)}% ready</span>
                      </div>
                    )}
                    {(hasOverlap || late) && <em>{hasOverlap ? "!" : "Late"}</em>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Right Side Panel ──────────────────────────────────────────── */}
        <aside className="ps-side">
          {/* Job Details */}
          <section className="ps-panel">
            <div className="ps-panel-head">
              <h2>Job Details</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selectedJob && <StatusChip status={selectedJob.status} />}
                {selectedJob && (
                  <button
                    type="button"
                    onClick={() => setFactSheetId(selectedJob.id)}
                    style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontWeight: 600, color: "#374151" }}
                    title="Open full fact sheet"
                  >
                    Full Sheet ↗
                  </button>
                )}
              </div>
            </div>
            {selectedJob ? (
              <div className="ps-editor">
                <label>
                  Project
                  <input
                    value={selectedJob.name}
                    onChange={(e) => updateJob(selectedJob.id, { name: e.target.value })}
                  />
                </label>
                {selectedJob.sourceType === "master" && (
                  <div className="ps-source-note">
                    Excel row {selectedJob.sourceRow} · Job {selectedJob.jobNumber || selectedJob.id}
                  </div>
                )}
                <label>
                  Job number
                  <input
                    value={selectedJob.jobNumber}
                    onChange={(e) => updateJob(selectedJob.id, { jobNumber: e.target.value })}
                  />
                </label>
                <label>
                  Client / District
                  <input
                    value={selectedJob.client}
                    onChange={(e) => updateJob(selectedJob.id, { client: e.target.value })}
                  />
                </label>
                <div className="ps-two">
                  <label>
                    Line
                    <select value={selectedJob.line} onChange={(e) => updateJob(selectedJob.id, { line: e.target.value })}>
                      {LINES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      <option value={QUEUE}>Queue</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={selectedJob.status} onChange={(e) => updateJob(selectedJob.id, { status: e.target.value })}>
                      {Object.entries(STATUS_CONFIG).map(([key, v]) => (
                        <option key={key} value={key}>{v.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Production Dates */}
                <section className="ps-date-block" aria-label="Production dates">
                  <div className="ps-date-block-head">
                    <h3>Production Dates</h3>
                    <span>{selectedJob.sourceType === "master" ? "From master Excel" : "Website schedule"}</span>
                  </div>
                  <div className="ps-date-grid">
                    <label>
                      <span>Topset Date<small>{selectedDateHelp.start}</small></span>
                      <input type="date" value={selectedJob.start} onChange={(e) => updateJob(selectedJob.id, { start: e.target.value })} />
                    </label>
                    <label>
                      <span>Topset Complete Date<small>{selectedDateHelp.offLine}</small></span>
                      <input type="date" value={selectedJob.offLine || defaultTopsetCompleteDate(selectedJob.start)} onChange={(e) => updateJob(selectedJob.id, { offLine: e.target.value })} />
                    </label>
                    <label>
                      <span>Shipping Date<small>{selectedDateHelp.end}</small></span>
                      <input type="date" value={selectedJob.end} onChange={(e) => updateJob(selectedJob.id, { end: e.target.value })} />
                    </label>
                    <label>
                      <span>Set Date<small>{selectedDateHelp.due}</small></span>
                      <input type="date" value={selectedJob.due} onChange={(e) => updateJob(selectedJob.id, { due: e.target.value })} />
                    </label>
                  </div>
                  <div className="ps-date-summary">
                    <div>
                      <strong>{dateDiffDays(selectedJob.start, selectedJob.end)}</strong>
                      <span>factory days</span>
                    </div>
                    <div>
                      <strong>
                        {selectedJob.end > selectedJob.due
                          ? `${dateDiffDays(selectedJob.due, selectedJob.end)} late`
                          : `${dateDiffDays(selectedJob.end, selectedJob.due)} buffer`}
                      </strong>
                      <span>ship to set</span>
                    </div>
                  </div>
                </section>

                <label>
                  Color
                  <input type="color" value={selectedJob.color} onChange={(e) => updateJob(selectedJob.id, { color: e.target.value })} />
                </label>
                <div className="ps-three">
                  <label>
                    Modules
                    <input type="number" min="1" value={selectedJob.modules} onChange={(e) => updateJob(selectedJob.id, { modules: Number(e.target.value) })} />
                  </label>
                  <label>
                    Crew
                    <input type="number" min="1" value={selectedJob.crew} onChange={(e) => updateJob(selectedJob.id, { crew: Number(e.target.value) })} />
                  </label>
                  <label>
                    Progress %
                    <input type="number" min="0" max="100" value={selectedJob.progress} onChange={(e) => updateJob(selectedJob.id, { progress: Number(e.target.value) })} />
                  </label>
                </div>
                <label>
                  Priority
                  <select value={selectedJob.priority} onChange={(e) => updateJob(selectedJob.id, { priority: e.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
                <label>
                  Project Manager
                  <input
                    type="text"
                    value={selectedJob.pm || ""}
                    placeholder="e.g. Joe/Rod"
                    onChange={(e) => updateJob(selectedJob.id, { pm: e.target.value })}
                  />
                </label>

                {/* Master Excel fields (only when sourced from Excel) */}
                {selectedJob.sourceType === "master" && (
                  <section className="ps-master-fields" aria-label="Master Excel fields">
                    <div className="ps-master-head">
                      <h3>Master Excel Fields</h3>
                      <span>Writes back to On Line Upcoming</span>
                    </div>
                    <label>
                      Contract
                      <textarea value={selectedJob.master.contract} onChange={(e) => updateMasterField(selectedJob.id, "contract", e.target.value)} />
                    </label>
                    <div className="ps-two">
                      <label>
                        Submittals Out
                        <textarea value={selectedJob.master.submittalsOut} onChange={(e) => updateMasterField(selectedJob.id, "submittalsOut", e.target.value)} />
                      </label>
                      <label>
                        Submittals Received
                        <textarea value={selectedJob.master.submittalsReceived} onChange={(e) => updateMasterField(selectedJob.id, "submittalsReceived", e.target.value)} />
                      </label>
                    </div>
                    <div className="ps-two">
                      <label>
                        DSA Status
                        <textarea value={selectedJob.master.dsaStatus} onChange={(e) => updateMasterField(selectedJob.id, "dsaStatus", e.target.value)} />
                      </label>
                      <label>
                        DSA Redlines
                        <textarea value={selectedJob.master.dsaRedlines} onChange={(e) => updateMasterField(selectedJob.id, "dsaRedlines", e.target.value)} />
                      </label>
                    </div>
                    <label>
                      Est. DSA Approval Date
                      <input value={selectedJob.master.dsaApproval} onChange={(e) => updateMasterField(selectedJob.id, "dsaApproval", e.target.value)} />
                    </label>
                    <div className="ps-two">
                      <label>
                        Inspector
                        <input value={selectedJob.master.inspector} onChange={(e) => updateMasterField(selectedJob.id, "inspector", e.target.value)} />
                      </label>
                      <label>
                        Job Card
                        <input value={selectedJob.master.jobCard} onChange={(e) => updateMasterField(selectedJob.id, "jobCard", e.target.value)} />
                      </label>
                    </div>
                    <div className="ps-two">
                      <label>
                        Lab
                        <input value={selectedJob.master.lab} onChange={(e) => updateMasterField(selectedJob.id, "lab", e.target.value)} />
                      </label>
                      <label>
                        Factory Subcontract Status
                        <textarea value={selectedJob.master.subcontractStatus} onChange={(e) => updateMasterField(selectedJob.id, "subcontractStatus", e.target.value)} />
                      </label>
                    </div>
                    <label>
                      Open Items
                      <textarea value={selectedJob.master.openItems} onChange={(e) => updateMasterField(selectedJob.id, "openItems", e.target.value)} />
                    </label>
                    <label>
                      PM Update
                      <textarea value={selectedJob.master.pmUpdate} onChange={(e) => updateMasterField(selectedJob.id, "pmUpdate", e.target.value)} />
                    </label>
                  </section>
                )}

                {/* Readiness */}
                <fieldset className="ps-readiness">
                  <legend>Production readiness</legend>
                  {[["drawings","Drawings"],["materials","Materials"],["permits","Permits"],["inspections","QA plan"]].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={selectedJob.readiness[key]}
                        onChange={(e) => updateJob(selectedJob.id, { readiness: { ...selectedJob.readiness, [key]: e.target.checked } })}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                <label>
                  Notes
                  <textarea
                    value={selectedJob.notes}
                    onChange={(e) =>
                      updateJob(selectedJob.id, {
                        notes: e.target.value,
                        master: selectedJob.sourceType === "master"
                          ? {
                              ...selectedJob.master,
                              openItems: e.target.value.split(/\n\nPM Update:\s*/)[0] || "",
                              pmUpdate: e.target.value.split(/\n\nPM Update:\s*/)[1] || selectedJob.master.pmUpdate,
                            }
                          : selectedJob.master,
                      })
                    }
                  />
                </label>
                <div className="ps-editor-actions">
                  <Button tone="quiet" onClick={duplicateSelected}>Duplicate</Button>
                  <Button tone="danger" onClick={deleteSelected}>Delete</Button>
                </div>
              </div>
            ) : (
              <p className="ps-empty">Select a job, drag across a line to create one, or add a job from the top bar.</p>
            )}
          </section>

          {/* Risks & Conflicts */}
          <section className="ps-panel">
            <h2>Risks &amp; Conflicts</h2>
            <div className="ps-risk-list">
              {risks.length ? (
                risks.map((risk, i) => (
                  <button key={`${risk.type}-${i}`} type="button" onClick={() => risk.job && setSelectedId(risk.job.id)}>
                    <strong>{risk.type}</strong>
                    <span>{risk.job ? jobLabel(risk.job) : risk.detail}</span>
                    {risk.job && <small>{risk.detail}</small>}
                  </button>
                ))
              ) : (
                <p className="ps-empty">No current conflicts. Lines are clean.</p>
              )}
            </div>
          </section>

          {/* Unscheduled Queue */}
          <section className="ps-panel">
            <h2>Unscheduled Queue</h2>
            <div className="ps-queue">
              {queuedRankedJobs.length ? (
                queuedRankedJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    draggable
                    onDragStart={() => setDraggedQueueJobId(job.id)}
                    onDragEnd={() => setDraggedQueueJobId(null)}
                    onClick={() => setSelectedId(job.id)}
                  >
                    <i style={{ background: job.color }} />
                    <span>{jobLabel(job)}</span>
                    <small>{job.modules} modules · score {job.queueScore}</small>
                    <small className={`ps-queue-badge is-${job.queueBucket.tone}`}>{job.queueBucket.label}</small>
                    <small>Best line: {bestLineByQueueJob[job.id] || "L1"}</small>
                    <small>
                      <span
                        className="ps-mini-btn"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQueueJobToLine(job.id, bestLineByQueueJob[job.id] || "L1");
                          showToast(`Moved to ${bestLineByQueueJob[job.id] || "L1"}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          e.stopPropagation();
                          moveQueueJobToLine(job.id, bestLineByQueueJob[job.id] || "L1");
                          showToast(`Moved to ${bestLineByQueueJob[job.id] || "L1"}`);
                        }}
                      >
                        Place on best line
                      </span>
                    </small>
                  </button>
                ))
              ) : (
                <p className="ps-empty">No queued work.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      </>
      ) : (
        <ModuleWorkspace
          module={activeModuleConfig}
          jobs={workingJobs}
          pipelineDeals={pipelineDeals}
          setPipelineDeals={setPipelineDeals}
          submittals={submittals}
          kpis={kpis}
          risks={risks}
          overlaps={overlaps}
          lineUtilization={lineUtilization}
          excelSync={excelSync}
          canViewPrices={canViewPrices}
          userAdmin={{
            canManage: canManageUsers,
            profiles: userProfiles.profiles,
            loading: userProfiles.loading,
            error: userProfiles.error,
            saveProfile: userProfiles.saveProfile,
            deleteProfile: userProfiles.deleteProfile,
          }}
          onOpenProduction={(jobId) => {
            setSelectedId(jobId);
            setStatusFilter("all");
            setLineFilter("all");
            setActiveModule("production");
          }}
          onFilterByPm={(pm) => {
            setPmFilter(pm);
            setStatusFilter("all");
            setLineFilter("all");
            setActiveModule("production");
          }}
          onAddJobFromDeal={addJobFromDeal}
          onOpenFactSheet={setFactSheetId}
        />
      )}

      {toast && <div className="ps-toast">{toast}</div>}

      {factSheetId && (() => {
        const fsJob = workingJobs.find((j) => j.id === factSheetId);
        return fsJob ? (
          <JobFactSheet
            job={fsJob}
            onClose={() => setFactSheetId(null)}
            updateJob={updateJob}
            updateMasterField={updateMasterField}
          />
        ) : null;
      })()}
    </main>
  );
}

// Named exports for global reuse
export { JobFactSheet, FS_TABS, STATUS_CONFIG, jobLabel, displayDate, normalizeJob };
