import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "../hooks/useJobs.js";

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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 86400000;
const HEADER_H = 72;   // increased to fit month + week row
const ROW_H = 76;
const MIN_DRAW_PX = 10;
const EXCEL_API_URL = "http://127.0.0.1:5174";
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
    offLine: "2026-02-16",
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
    offLine: "2026-04-22",
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
    offLine: "2026-06-26",
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
    offLine: "2026-07-29",
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

function defaultOffLineDate(start, end) {
  if (!start || !end) return end || start || "2026-01-01";
  return end > start ? addDays(end, -1) : end;
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

function getBarRange(job) {
  const endDate = job.end > job.due ? job.end : job.due;
  return { start: job.start, end: endDate };
}

function getBarGradient(job) {
  const { start, end } = getBarRange(job);
  const offLinePct = percentBetween(start, end, job.offLine || defaultOffLineDate(job.start, job.end));
  const shipPct = percentBetween(start, end, job.end);
  const setPct = percentBetween(start, end, job.due);
  const stops = [offLinePct, shipPct, setPct].map((stop) => clamp(stop, 0, 100)).sort((a, b) => a - b);
  const shades = getColorShades(job.color);
  const soft = rgbToCss(mixRgb(hexToRgb(job.color), { r: 255, g: 255, b: 255 }, 0.12));

  return `linear-gradient(90deg, ${shades.dark} 0%, ${shades.dark} ${stops[0]}%, ${shades.base} ${stops[0]}%, ${shades.base} ${stops[1]}%, ${soft} ${stops[1]}%, ${soft} ${stops[2]}%, ${shades.light} ${stops[2]}%, ${shades.light} 100%)`;
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
    offLine: job.offLine || job.off_line || defaultOffLineDate(
      job.start || job.start_date || "2026-01-05",
      job.end || job.end_date || "2026-01-19",
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
    "id","name","client","line","start","offLine","end","due","color","status",
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
      offLine: row.offLine || row.off_line,
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

function ModulePlaceholder({ module, jobs, kpis }) {
  const nextSteps = {
    dashboard: ["Backlog and booked work KPIs", "Line capacity and late-risk rollups", "Sales-to-production handoff alerts"],
    pipeline: ["Opportunity stages and probabilities", "Estimated modules and revenue", "Convert awarded work into production jobs"],
    projects: ["Unified project profile", "NetSuite and Procore reference fields", "Milestones from sales through site set"],
    reports: ["Weekly production report", "Pipeline forecast report", "Late jobs and constraint report"],
    settings: ["Production lines and capacity", "Status and priority lists", "Integration and Excel mappings"],
  }[module.id] || [];

  return (
    <section className="ps-module-page" aria-label={module.title}>
      <div className="ps-module-head">
        <div>
          <p className="ps-eyebrow">Operations Hub</p>
          <h2>{module.title}</h2>
          <span>{module.description}</span>
        </div>
      </div>
      <div className="ps-module-grid">
        <section>
          <h3>Starting Point</h3>
          <p>
            This module will use the same project data backbone as the production schedule, so teams can move work from sales planning into factory execution without rebuilding the same information in another spreadsheet.
          </p>
        </section>
        <section>
          <h3>Current Data</h3>
          <div className="ps-module-metrics">
            <div><strong>{jobs.length}</strong><span>Jobs</span></div>
            <div><strong>{kpis.modules}</strong><span>Modules</span></div>
            <div><strong>{kpis.utilization}</strong><span>Utilization</span></div>
          </div>
        </section>
        <section>
          <h3>Next Build Items</h3>
          <ul>
            {nextSteps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </section>
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
      offLine: "Website schedule date",
      end: "Excel column: Shipping Date",
      due: "Excel column: Set Date",
    };
  }
  return {
    start: "Production work begins",
    offLine: "Factory line completion",
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

export default function ProductionScheduler() {
  const {
    jobs,
    setJobs,
    setJobsBulk,
    loading: dbLoading,
    dbError,
    refresh: dbRefresh,
    isSupabase,
  } = useJobs(SAMPLE_JOBS, normalizeJob);

  const [selectedId, setSelectedId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [summaryList, setSummaryList] = useState(null);
  const [activeModule, setActiveModule] = useState("production");
  const [dayPx, setDayPx] = useState(4);
  const [excelSync, setExcelSync] = useState({
    connected: false,
    busy: false,
    lastSyncedAt: "",
    message: "Excel sync not connected",
  });
  const gridRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);

  const today = formatDate(new Date());
  const timelineRange = useMemo(() => {
    const validDates = [today, ...jobs.flatMap((job) => [job.start, job.end, job.due])]
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

  // ── Auto-scroll to today on mount ────────────────────────────────────────
  useEffect(() => {
    if (!gridRef.current) return;
    const dayOffset = diffDays(timelineRange.start, toDate(today));
    const todayPx = dayOffset * dayPx;
    // Center today in the visible area, offset by ~200px for context
    const containerW = gridRef.current.clientWidth;
    gridRef.current.scrollLeft = Math.max(0, todayPx - containerW / 2 + 100);
  }, [dayPx, timelineRange.start, today]);

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
      const payload = await res.json();
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
      const payload = await res.json();
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
        if (!next.offLine || next.offLine < next.start) next.offLine = next.start;
        if (next.offLine > next.end) next.offLine = defaultOffLineDate(next.start, next.end);
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
        offLine: "2026-08-26",
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
    const copy = normalizeJob(
      {
        ...selectedJob,
        id: String(nextId++),
        name: `${selectedJob.name} Copy`,
        start: addDays(selectedJob.end, 7),
        offLine: addDays(selectedJob.offLine || defaultOffLineDate(selectedJob.start, selectedJob.end), 7),
        end: addDays(selectedJob.end, 7 + dateDiffDays(selectedJob.start, selectedJob.end) - 1),
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
      origOffLine: job.offLine || defaultOffLineDate(job.start, job.end),
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
      origOffLine: job.offLine || defaultOffLineDate(job.start, job.end),
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
              return { ...job, start: start > latestAllowedStart ? latestAllowedStart : start };
            }
            if (drag.type === "resize-right") {
              const nextEnd = addDays(drag.origEnd, delta);
              const nextDue = addDays(drag.origDue, delta);
              const nextOffLine = defaultOffLineDate(job.start, nextEnd);
              const minEnd = addDays(job.start, 1);
              if (drag.origDue > drag.origEnd) {
                return { ...job, due: nextDue < minEnd ? minEnd : nextDue };
              }
              return { ...job, offLine: nextOffLine, end: nextEnd < minEnd ? minEnd : nextEnd };
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
            offLine: defaultOffLineDate(startDate, endDate),
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
                const barRange = getBarRange(job);
                const width = Math.max(30, dateDiffDays(barRange.start, barRange.end) * dayPx);
                const offLineDate = job.offLine || defaultOffLineDate(job.start, job.end);
                const offLinePct = percentBetween(barRange.start, barRange.end, offLineDate);
                const shipPct = percentBetween(barRange.start, barRange.end, job.end);
                const setPct = percentBetween(barRange.start, barRange.end, job.due);
                return (
                  <div
                    className={`ps-job ${selectedId === job.id ? "is-selected" : ""} ${hasOverlap ? "has-overlap" : ""}`}
                    key={job.id}
                    style={{
                      top: HEADER_H + lineIndex * ROW_H + 16,
                      left: dateToX(barRange.start),
                      width,
                      background: getBarGradient(job),
                    }}
                    title={`${job.name}\nTopset: ${displayDate(job.start)}\nOff the Line: ${displayDate(offLineDate)}\nShipping: ${displayDate(job.end)}\nSet: ${displayDate(job.due)}\n${job.modules} modules`}
                    onMouseDown={(e) => startDrag(e, job.id)}
                  >
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
                    <i className="ps-date-line ps-date-line-topset" style={{ left: "0%" }} title={`Topset: ${displayDate(job.start)}`} />
                    <i className="ps-date-line ps-date-line-offline" style={{ left: `${offLinePct}%` }} title={`Off the Line: ${displayDate(offLineDate)}`}>
                      <span>Off Line</span>
                    </i>
                    <i className="ps-date-line ps-date-line-ship" style={{ left: `${shipPct}%` }} title={`Ship: ${displayDate(job.end)}`}>
                      <span>Shipping</span>
                    </i>
                    <i className="ps-date-line ps-date-line-set" style={{ left: `${setPct}%` }} title={`Set: ${displayDate(job.due)}`} />
                    <span>{job.name}</span>
                    <small>Ship {displayDate(job.end)} · {job.modules} mod</small>
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
                      <span>Off the Line<small>{selectedDateHelp.offLine}</small></span>
                      <input type="date" value={selectedJob.offLine || defaultOffLineDate(selectedJob.start, selectedJob.end)} onChange={(e) => updateJob(selectedJob.id, { offLine: e.target.value })} />
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
        <ModulePlaceholder module={activeModuleConfig} jobs={jobs} kpis={kpis} />
      )}

      {toast && <div className="ps-toast">{toast}</div>}
    </main>
  );
}
