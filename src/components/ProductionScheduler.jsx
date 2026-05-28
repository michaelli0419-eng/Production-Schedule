import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "../hooks/useJobs.js";
import { usePipelineDeals } from "../hooks/usePipelineDeals.js";
import { useUserProfiles } from "../hooks/useUserProfiles.js";
import { isSupabaseEnabled } from "../lib/supabase.js";

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
  { id: "pipeline", label: "Sales Pipeline", title: "Sales Pipeline", description: "Track opportunities from lead through award before they become scheduled production jobs." },
  { id: "projects", label: "Projects", title: "Projects", description: "One shared project record connecting sales, production, shipping, site set, NetSuite, and Procore context." },
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
  return {
    id: job.id || String(Date.now() + index),
    name: job.name || job.job_name || "New School Project",
    client: job.client || "District",
    line: LINE_IDS.includes(job.line) || job.line === QUEUE ? job.line : "L1",
    start: job.start || job.start_date || "2026-01-05",
    end: job.end || job.end_date || "2026-01-19",
    due: job.due || job.due_date || job.end || job.end_date || "2026-01-19",
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
    sourceType: job.sourceType || "",
    sourceSheet: job.sourceSheet || "",
    sourceRow: job.sourceRow || "",
    jobNumber: job.jobNumber || "",
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

function ModuleWorkspace({
  module,
  jobs,
  pipelineDeals,
  kpis,
  risks,
  lineUtilization,
  excelSync,
  onOpenProduction,
  canViewPrices,
  userAdmin,
}) {
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineClientFilter, setPipelineClientFilter] = useState("all");
  const [pipelineBdmFilter, setPipelineBdmFilter] = useState("all");
  const [pipelineStageFilter, setPipelineStageFilter] = useState("all");
  const [pipelineBuildingFilter, setPipelineBuildingFilter] = useState("all");

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

  if (module.id === "dashboard") {
    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="SCM operating bridge" />
        <div className="ps-dashboard-grid">
          <section className="ps-bridge-panel">
            <div className="ps-section-head">
              <h2>NetSuite to Procore Bridge</h2>
              <span>{bridgeGaps.length} records need clean handoff data</span>
            </div>
            <div className="ps-bridge-flow">
              {["NetSuite", "SCM Hub", "Procore"].map((system, index) => (
                <div key={system} className={index === 1 ? "is-core" : ""}>
                  <strong>{system}</strong>
                  <span>
                    {index === 0 ? "contract, customer, revenue" : index === 1 ? "schedule, risk, readiness" : "field, submittals, closeout"}
                  </span>
                </div>
              ))}
            </div>
            <div className="ps-alert-list">
              {bridgeGaps.map(({ job, integration, readiness }) => (
                <button key={job.id} type="button" onClick={() => onOpenProduction(job.id)}>
                  <span className={`ps-status-dot is-${integration.tone}`} />
                  <strong>{job.name}</strong>
                  <small>{integration.label} - {readiness}% ready - ship {displayDate(job.end)}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="ps-ops-strip">
            <MetricBlock label="Scheduled Jobs" value={kpis.jobs} detail={`${kpis.modules} modules`} />
            <MetricBlock label="Active Production" value={kpis.production} detail="on factory lines" />
            <MetricBlock label="Plant Utilization" value={kpis.utilization} detail="current date span" />
            <MetricBlock label="Readiness" value={kpis.readiness} detail="average gate score" />
          </section>

          <section className="ps-table-panel">
            <div className="ps-section-head">
              <h2>Line Capacity</h2>
              <span>Factory view by production line</span>
            </div>
            <div className="ps-line-stack">
              {lineUtilization.map((line) => {
                const detail = LINES.find((item) => item.id === line.line);
                return (
                  <div key={line.line}>
                    <strong>{detail?.name || line.line}</strong>
                    <span>{line.jobs} jobs - {line.modules} modules</span>
                    <div className="ps-meter"><i style={{ width: `${line.utilization}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ps-table-panel">
            <div className="ps-section-head">
              <h2>Priority Risks</h2>
              <span>Schedule and handoff exceptions</span>
            </div>
            <div className="ps-compact-list">
              {risks.length ? risks.map((risk, index) => (
                <button key={`${risk.type}-${index}`} type="button" onClick={() => risk.job && onOpenProduction(risk.job.id)}>
                  <strong>{risk.type}</strong>
                  <span>{risk.job?.name || risk.detail}</span>
                  <small>{risk.job ? risk.detail : "line conflict"}</small>
                </button>
              )) : <p className="ps-empty">No current conflicts.</p>}
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (module.id === "pipeline") {
    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Sales to production" />
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Pipeline Filters</h2>
            <span>Filter by customer, BDM, stage, and building type</span>
          </div>
          <div className="ps-pipeline-filters">
            <input
              className="ps-input"
              type="search"
              placeholder="Search project, customer, job #, notes"
              value={pipelineSearch}
              onChange={(event) => setPipelineSearch(event.target.value)}
            />
            <select className="ps-input" value={pipelineClientFilter} onChange={(event) => setPipelineClientFilter(event.target.value)}>
              <option value="all">All Customers</option>
              {pipelineClients.map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
            <select className="ps-input" value={pipelineBdmFilter} onChange={(event) => setPipelineBdmFilter(event.target.value)}>
              <option value="all">All BDMs</option>
              {pipelineBdms.map((bdm) => <option key={bdm} value={bdm}>{bdm}</option>)}
            </select>
            <select className="ps-input" value={pipelineStageFilter} onChange={(event) => setPipelineStageFilter(event.target.value)}>
              <option value="all">All Stages</option>
              {PIPELINE_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </select>
            <select className="ps-input" value={pipelineBuildingFilter} onChange={(event) => setPipelineBuildingFilter(event.target.value)}>
              <option value="all">All Building Types</option>
              {pipelineBuildingTypes.map((building) => <option key={building} value={building}>{building}</option>)}
            </select>
          </div>
        </section>
        <div className="ps-stage-board">
          {pipelineTotals.map((stage) => (
            <section key={stage.id} className="ps-stage-column">
              <div className="ps-stage-head">
                <strong>{stage.label}</strong>
                <span>{stage.count} deals - {formatProtectedMoney(stage.weighted, canViewPrices)}</span>
              </div>
              {pipelineRows.filter((row) => row.stage.id === stage.id).map(({ deal, revenue, weighted, closeDate }) => (
                <button key={deal.id} type="button" className="ps-deal-card" onClick={() => onOpenProduction(jobs[0]?.id)}>
                  <strong>{deal.opportunityName}</strong>
                  <span>{deal.client}</span>
                  <small>{formatProtectedMoney(revenue, canViewPrices)}</small>
                  <div>
                    <b>{canViewPrices ? `${formatMoney(weighted)} weighted` : "Weighted price locked"}</b>
                    <em>{displayDate(closeDate)}</em>
                  </div>
                </button>
              ))}
            </section>
          ))}
        </div>
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>2026 Sales Pipeline</h2>
            <span>{filteredPipelineRows.length} opportunities shown</span>
          </div>
          <div className="ps-pipeline-table-wrap">
            <table className="ps-pipeline-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Project Name</th>
                  <th>BDM</th>
                  <th>Job #</th>
                  <th>Contract Value</th>
                  <th>Building Type</th>
                  <th>Stage</th>
                  <th>Close Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPipelineRows.map(({ deal, stage, revenue, closeDate }) => (
                  <tr key={deal.id}>
                    <td>{deal.client || "-"}</td>
                    <td>{deal.opportunityName || "-"}</td>
                    <td>{deal.estimator || "-"}</td>
                    <td>{deal.jobNumber || "-"}</td>
                    <td>{formatProtectedMoney(revenue, canViewPrices)}</td>
                    <td>{deal.buildingType || "-"}</td>
                    <td>{stage.label}</td>
                    <td>{displayDate(closeDate)}</td>
                    <td>{deal.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  if (module.id === "projects") {
    return (
      <section className="ps-module-page" aria-label={module.title}>
        <ModuleHead module={module} eyebrow="Single project record" />
        <section className="ps-table-panel">
          <div className="ps-section-head">
            <h2>Project Registry</h2>
            <span>Shared record across sales, plant, accounting, and field teams</span>
          </div>
          <div className="ps-project-table">
            <div className="ps-project-row is-header">
              <span>Project</span><span>IDs</span><span>Phase</span><span>Dates</span><span>Bridge</span>
            </div>
            {jobs.map((job) => {
              const status = integrationStatus(job);
              return (
                <button key={job.id} type="button" className="ps-project-row" onClick={() => onOpenProduction(job.id)}>
                  <span><strong>{job.name}</strong><small>{job.client}</small></span>
                  <span><strong>{job.jobNumber || "No job #"}</strong><small>{job.sourceType === "master" ? "Master Excel" : "Website"}</small></span>
                  <span><StatusChip status={job.status} /></span>
                  <span><strong>{displayDate(job.start)}</strong><small>ship {displayDate(job.end)}</small></span>
                  <span><i className={`ps-pill is-${status.tone}`}>{status.label}</i></span>
                </button>
              );
            })}
          </div>
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
                <span>{job.name}</span>
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

export default function ProductionScheduler({ currentUser, permissions, onLogout }) {
  const {
    jobs,
    setJobs,
    setJobsBulk,
    loading: dbLoading,
    dbError,
    refresh: dbRefresh,
    isSupabase,
  } = useJobs(SAMPLE_JOBS, normalizeJob);
  const {
    deals: pipelineDeals,
    setDealsBulk: setPipelineDealsBulk,
  } = usePipelineDeals(SAMPLE_PIPELINE_DEALS);
  const userProfiles = useUserProfiles();

  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [summaryList, setSummaryList] = useState(null);
  const [activeModule, setActiveModule] = useState("production");
  const [scheduleView, setScheduleView] = useState("production");
  const [dayPx, setDayPx] = useState(4);
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

  const today = formatDate(new Date());
  const timelineRange = useMemo(() => {
    const validDates = [today, ...jobs.flatMap((job) => {
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
  }, [jobs, today]);
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

  const visibleJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesText = !term || `${job.name} ${job.client} ${job.notes}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || job.status === statusFilter;
      const matchesLine = lineFilter === "all" || job.line === lineFilter;
      return matchesText && matchesStatus && matchesLine;
    });
  }, [jobs, lineFilter, search, statusFilter]);

  const scheduledJobs = visibleJobs.filter((job) => LINE_IDS.includes(job.line));
  const queuedJobs = visibleJobs.filter((job) => job.line === QUEUE);
  const selectedJob = jobs.find((job) => job.id === selectedId) || null;
  const selectedDateHelp = dateFieldHelp(selectedJob);

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
      const lineJobs = jobs.filter((j) => j.line === line);
      for (let i = 0; i < lineJobs.length; i++) {
        for (let k = i + 1; k < lineJobs.length; k++) {
          const a = lineJobs[i];
          const b = lineJobs[k];
          if (rangesOverlap(a.start, a.end, b.start, b.end)) {
            result.push({
              line,
              start: a.start > b.start ? a.start : b.start,
              end: a.end < b.end ? a.end : b.end,
              jobs: [a.id, b.id],
              names: [a.name, b.name],
            });
          }
        }
      }
    }
    return result;
  }, [jobs]);

  const lineUtilization = useMemo(
    () =>
      LINE_IDS.map((line) => {
        const lineJobs = jobs.filter((j) => j.line === line);
        const usedDays = lineJobs.reduce((sum, j) => sum + dateDiffDays(j.start, j.end), 0);
        const modules = lineJobs.reduce((sum, j) => sum + j.modules, 0);
        return {
          line,
          utilization: Math.min(100, Math.round((usedDays / totalDays) * 100)),
          modules,
          jobs: lineJobs.length,
        };
      }),
    [jobs, totalDays],
  );

  const risks = useMemo(() => {
    const riskList = [];
    jobs.forEach((job) => {
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
  }, [jobs, overlaps]);

  const kpis = useMemo(() => {
    const scheduled = jobs.filter((j) => LINE_IDS.includes(j.line));
    const totalModules = jobs.reduce((sum, j) => sum + j.modules, 0);
    const avgReadiness = Math.round(jobs.reduce((sum, j) => sum + readinessScore(j), 0) / Math.max(1, jobs.length));
    return {
      jobs: jobs.length,
      modules: totalModules,
      production: jobs.filter((j) => j.status === "production").length,
      queued: jobs.filter((j) => j.line === QUEUE).length,
      readiness: `${avgReadiness}%`,
      utilization: `${Math.round(scheduled.reduce((sum, j) => sum + dateDiffDays(j.start, j.end), 0) / (totalDays * LINE_IDS.length) * 100)}%`,
    };
  }, [jobs, totalDays]);

  const summaryJobs = useMemo(() => {
    if (!summaryList) return [];

    if (summaryList === "production") return jobs.filter((j) => j.status === "production");
    if (summaryList === "queued") return jobs.filter((j) => j.line === QUEUE);
    if (summaryList === "jobs") return jobs;
    if (summaryList === "readiness") return jobs.filter((j) => readinessScore(j) < 100);

    return [];
  }, [jobs, summaryList]);

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
      const res = await fetch(`${EXCEL_API_URL}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
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
    const url = URL.createObjectURL(new Blob([jobsToCSV(jobs)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "production_schedule.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }

  function onGridMouseDown(e) {
    if (e.button !== 0) return;
    const line = getLineFromY(e.clientY);
    if (!line) return;
    const date = xToDate(getX(e.clientX));
    const hit = jobs.find((j) => j.line === line && date >= j.start && date <= j.end);
    if (hit) { setSelectedId(hit.id); return; }
    setSelectedId(null);
    const startX = getX(e.clientX);
    setDrawing({ line, startX, currentX: startX, hasDragged: false });
  }

  function startDrag(e, jobId) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(jobId);
    const job = jobs.find((j) => j.id === jobId);
    setDragging({
      jobId,
      type: "move",
      startX: getX(e.clientX),
      origStart: job.start,
      origOffLine: job.offLine || defaultTopsetCompleteDate(job.start),
      origEnd: job.end,
      origDue: job.due,
    });
  }

  function startResize(e, jobId, edge) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(jobId);
    const job = jobs.find((j) => j.id === jobId);
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
              const latestAllowedStart = addDays(drag.origOffLine < drag.origEnd ? drag.origOffLine : drag.origEnd, -1);
              const start = addDays(drag.origStart, delta);
              const nextStart = start > latestAllowedStart ? latestAllowedStart : start;
              return { ...job, start: nextStart, offLine: defaultTopsetCompleteDate(nextStart) };
            }
            if (drag.type === "resize-right") {
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
            return {
              ...job,
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
  }, [dayPx, drawing, getX, xToDate]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (dbLoading) {
    return (
      <main className="ps-shell ps-loading-shell">
        <div className="ps-loading">
          <div className="ps-loading-spinner" />
          <p>{isSupabase ? "Loading schedule from database…" : "Loading schedule…"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ps-shell">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="ps-topbar">
        <div className="ps-brand">
          <p className="ps-eyebrow">Silver Creek Modular</p>
          <h1>{activeModuleConfig.title}</h1>
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
                  <b>{job.jobNumber ? `${job.jobNumber} · ` : ""}{job.name}</b>
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
              ? (dbError ? dbError.slice(0, 40) : `${jobs.length} jobs synced`)
              : "Add .env.local to enable"}
          </span>
        </div>
      </section>

      {/* ── Main Workspace ──────────────────────────────────────────────── */}
      <div className="ps-workspace">
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
          <div className="ps-timeline" ref={gridRef} onMouseDown={onGridMouseDown}>
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
              {overlaps.map((o, i) => (
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
                    title={`${job.name}\n${layout.view.endLabel} view\nTopset: ${displayDate(layout.dates.start)}\nTopset Complete: ${displayDate(layout.dates.offLine)}\nShipping: ${displayDate(layout.dates.end)}\nSet: ${displayDate(layout.dates.due)}\n${job.modules} modules`}
                    onMouseDown={(e) => startDrag(e, job.id)}
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
                    <span>{job.name}</span>
                    <small>{layout.view.endLabel} {displayDate(getScheduleEnd(job, scheduleView))} · {job.modules} mod</small>
                    <b style={{ width: `${job.progress}%` }} />
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
              {selectedJob && <StatusChip status={selectedJob.status} />}
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
                    <span>{risk.job?.name || risk.detail}</span>
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
              {queuedJobs.length ? (
                queuedJobs.map((job) => (
                  <button key={job.id} type="button" onClick={() => setSelectedId(job.id)}>
                    <i style={{ background: job.color }} />
                    <span>{job.name}</span>
                    <small>{job.modules} modules</small>
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
          jobs={jobs}
          pipelineDeals={pipelineDeals}
          kpis={kpis}
          risks={risks}
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
        />
      )}

      {toast && <div className="ps-toast">{toast}</div>}
    </main>
  );
}
