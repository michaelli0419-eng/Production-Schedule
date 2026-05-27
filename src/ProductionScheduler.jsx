import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const YEAR = 2026;
const LINES = [
  { id: "L1", name: "Line 1", focus: "Pods + classrooms" },
  { id: "L2", name: "Line 2", focus: "Classroom wings" },
  { id: "L3", name: "Line 3", focus: "Admin + specialty" },
  { id: "L4", name: "Line 4", focus: "Final assembly" },
];
const LINE_IDS = LINES.map((line) => line.id);
const QUEUE = "QUEUE";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_PER_DAY = 86400000;
const HEADER_H = 58;
const ROW_H = 76;
const STATUS_CONFIG = {
  forecast: { label: "Forecast", color: "#64748b", bg: "#f1f5f9" },
  approved: { label: "Approved", color: "#2563eb", bg: "#dbeafe" },
  hold: { label: "Hold", color: "#b45309", bg: "#fef3c7" },
  production: { label: "Production", color: "#047857", bg: "#d1fae5" },
  delayed: { label: "Delayed", color: "#b91c1c", bg: "#fee2e2" },
  complete: { label: "Complete", color: "#6d28d9", bg: "#ede9fe" },
};
const JOB_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0f766e",
  "#be123c",
];
const SAMPLE_JOBS = [
  {
    id: "1",
    name: "LAUSD Classroom Village",
    client: "Los Angeles USD",
    line: "L1",
    start: "2026-01-05",
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

function totalYearDays() {
  return MONTHS.reduce((sum, _month, index) => sum + daysInMonth(YEAR, index), 0);
}

function toDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = toDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
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

function normalizeJob(job, index) {
  return {
    id: job.id || String(Date.now() + index),
    name: job.name || job.job_name || "New School Project",
    client: job.client || "District",
    line: LINE_IDS.includes(job.line) || job.line === QUEUE ? job.line : "L1",
    start: job.start || job.start_date || "2026-01-05",
    end: job.end || job.end_date || "2026-01-19",
    due: job.due || job.due_date || job.end || job.end_date || "2026-01-19",
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
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((header) => header.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || "" }), {});
  });
}

function jobsToCSV(jobs) {
  const headers = [
    "id",
    "name",
    "client",
    "line",
    "start",
    "end",
    "due",
    "color",
    "status",
    "modules",
    "crew",
    "priority",
    "progress",
    "drawings_ready",
    "materials_ready",
    "permits_ready",
    "inspections_ready",
    "notes",
  ];
  const rows = jobs.map((job) =>
    [
      job.id,
      job.name,
      job.client,
      job.line,
      job.start,
      job.end,
      job.due,
      job.color,
      job.status,
      job.modules,
      job.crew,
      job.priority,
      job.progress,
      job.readiness.drawings,
      job.readiness.materials,
      job.readiness.permits,
      job.readiness.inspections,
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

function Kpi({ label, value, sublabel, tone = "neutral" }) {
  return (
    <section className={`ps-kpi ps-kpi-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sublabel}</small>
    </section>
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

function readinessScore(job) {
  const values = Object.values(job.readiness);
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

export default function ProductionScheduler() {
  const [jobs, setJobs] = useState(() => {
    try {
      const saved = localStorage.getItem("scheduler-jobs-v2");
      const legacy = localStorage.getItem("scheduler-jobs");
      return (saved ? JSON.parse(saved) : legacy ? JSON.parse(legacy) : SAMPLE_JOBS).map(normalizeJob);
    } catch {
      return SAMPLE_JOBS;
    }
  });
  const [selectedId, setSelectedId] = useState(jobs[0]?.id || null);
  const [dragging, setDragging] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [dayPx, setDayPx] = useState(4);
  const gridRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);

  const totalDays = totalYearDays();
  const totalWidth = totalDays * dayPx;
  const today = formatDate(new Date());

  useEffect(() => {
    localStorage.setItem("scheduler-jobs-v2", JSON.stringify(jobs));
  }, [jobs]);

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

  useEffect(() => {
    dragRef.current = dragging;
  }, [dragging]);

  const monthTicks = useMemo(
    () =>
      MONTHS.reduce((ticks, label, index) => {
        const previous = ticks[index - 1];
        const x = previous ? previous.x + previous.width : 0;
        const width = daysInMonth(YEAR, index) * dayPx;
        return [...ticks, { label, x, width }];
      }, []),
    [dayPx],
  );

  const todayX = useMemo(() => {
    if (!today.startsWith(String(YEAR))) return null;
    const diff = Math.floor((toDate(today) - new Date(YEAR, 0, 1)) / MS_PER_DAY);
    return clamp(diff, 0, totalDays - 1) * dayPx;
  }, [dayPx, today, totalDays]);

  const overlaps = useMemo(() => {
    const result = [];
    for (const line of LINE_IDS) {
      const lineJobs = jobs.filter((job) => job.line === line);
      for (let i = 0; i < lineJobs.length; i += 1) {
        for (let k = i + 1; k < lineJobs.length; k += 1) {
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
        const lineJobs = jobs.filter((job) => job.line === line);
        const usedDays = lineJobs.reduce((sum, job) => sum + dateDiffDays(job.start, job.end), 0);
        const modules = lineJobs.reduce((sum, job) => sum + job.modules, 0);
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
        riskList.push({ type: "Late", job, detail: `${dateDiffDays(job.due, job.end)} days past due date` });
      }
      if (job.status === "hold" || job.status === "delayed") {
        riskList.push({ type: job.status === "hold" ? "Hold" : "Delay", job, detail: job.notes || "Needs review" });
      }
      if (readinessScore(job) < 75 && job.status !== "forecast") {
        riskList.push({ type: "Readiness", job, detail: `${readinessScore(job)}% production-ready` });
      }
    });
    overlaps.forEach((overlap) => {
      riskList.push({ type: "Overlap", detail: `${overlap.line}: ${overlap.names.join(" / ")}`, job: null });
    });
    return riskList.slice(0, 8);
  }, [jobs, overlaps]);

  const kpis = useMemo(() => {
    const scheduled = jobs.filter((job) => LINE_IDS.includes(job.line));
    const totalModules = jobs.reduce((sum, job) => sum + job.modules, 0);
    const avgReadiness = Math.round(jobs.reduce((sum, job) => sum + readinessScore(job), 0) / Math.max(1, jobs.length));
    return {
      jobs: jobs.length,
      modules: totalModules,
      production: jobs.filter((job) => job.status === "production").length,
      queued: jobs.filter((job) => job.line === QUEUE).length,
      readiness: `${avgReadiness}%`,
      utilization: `${Math.round(scheduled.reduce((sum, job) => sum + dateDiffDays(job.start, job.end), 0) / (totalDays * LINE_IDS.length) * 100)}%`,
    };
  }, [jobs, totalDays]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function dateToX(dateStr) {
    const diff = Math.floor((toDate(dateStr) - new Date(YEAR, 0, 1)) / MS_PER_DAY);
    return clamp(diff, 0, totalDays - 1) * dayPx;
  }

  const xToDate = useCallback((x) => {
    const days = clamp(Math.round(x / dayPx), 0, totalDays - 1);
    return formatDate(new Date(new Date(YEAR, 0, 1).getTime() + days * MS_PER_DAY));
  }, [dayPx, totalDays]);

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
    setJobs((current) => [...current, job]);
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
        end: addDays(selectedJob.end, 7 + dateDiffDays(selectedJob.start, selectedJob.end) - 1),
        due: addDays(selectedJob.due, 14),
      },
      nextId,
    );
    setJobs((current) => [...current, copy]);
    setSelectedId(copy.id);
    showToast("Job duplicated");
  }

  function deleteSelected() {
    if (!selectedJob) return;
    setJobs((current) => current.filter((job) => job.id !== selectedJob.id));
    setSelectedId(null);
    showToast("Job deleted");
  }

  function onFileChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      try {
        const imported = parseCSV(readerEvent.target.result).map(csvRowToJob);
        setJobs(imported);
        setSelectedId(imported[0]?.id || null);
        showToast(`Imported ${imported.length} jobs`);
      } catch {
        showToast("Import failed");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function exportCSV() {
    const url = URL.createObjectURL(new Blob([jobsToCSV(jobs)], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "production_schedule.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }

  function onGridMouseDown(event) {
    if (event.button !== 0) return;
    const line = getLineFromY(event.clientY);
    if (!line) return;
    const date = xToDate(getX(event.clientX));
    const hit = jobs.find((job) => job.line === line && date >= job.start && date <= job.end);
    if (hit) {
      setSelectedId(hit.id);
      return;
    }
    setSelectedId(null);
    setDrawing({ line, startX: getX(event.clientX), currentX: getX(event.clientX) });
  }

  function startDrag(event, jobId) {
    event.preventDefault();
    event.stopPropagation();
    const job = jobs.find((item) => item.id === jobId);
    setDragging({ jobId, startX: getX(event.clientX), origStart: job.start, origEnd: job.end });
  }

  useEffect(() => {
    function onMove(event) {
      if (dragRef.current) {
        const drag = dragRef.current;
        const delta = Math.round((getX(event.clientX) - drag.startX) / dayPx);
        setJobs((current) =>
          current.map((job) => {
            if (job.id !== drag.jobId) return job;
            const duration = dateDiffDays(drag.origStart, drag.origEnd) - 1;
            const start = addDays(drag.origStart, delta);
            return { ...job, start, end: addDays(start, duration) };
          }),
        );
      }
      if (drawing) {
        setDrawing((current) => ({ ...current, currentX: getX(event.clientX) }));
      }
    }

    function onUp() {
      if (dragRef.current) {
        setDragging(null);
        return;
      }
      if (drawing) {
        const startX = Math.min(drawing.startX, drawing.currentX);
        const endX = Math.max(drawing.startX, drawing.currentX);
        const id = String(nextId++);
        const job = normalizeJob(
          {
            id,
            name: "New School Project",
            client: "School District",
            line: drawing.line,
            start: xToDate(startX),
            end: xToDate(endX),
            due: addDays(xToDate(endX), 7),
            color: JOB_COLORS[nextId % JOB_COLORS.length],
            status: "forecast",
            modules: 12,
            crew: 10,
          },
          nextId,
        );
        setJobs((current) => [...current, job]);
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

  return (
    <main className="ps-shell">
      <header className="ps-topbar">
        <div>
          <p className="ps-eyebrow">Silver Creek Modular</p>
          <h1>Production Schedule</h1>
        </div>
        <div className="ps-actions">
          <Button onClick={() => addJob("L1")}>+ Job</Button>
          <Button tone="quiet" onClick={() => addJob(QUEUE)}>
            + Queue
          </Button>
          <Button tone="quiet" onClick={() => fileRef.current?.click()}>
            Import CSV
          </Button>
          <Button tone="dark" onClick={exportCSV}>
            Export
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="ps-hidden" onChange={onFileChange} />
        </div>
      </header>

      <section className="ps-kpis">
        <Kpi label="Jobs" value={kpis.jobs} sublabel={`${kpis.modules} total modules`} />
        <Kpi label="In Production" value={kpis.production} sublabel="active line work" tone="green" />
        <Kpi label="Plant Utilization" value={kpis.utilization} sublabel="year view across 4 lines" />
        <Kpi label="Avg. Readiness" value={kpis.readiness} sublabel="drawings, material, permits, QA" />
        <Kpi label="Queued" value={kpis.queued} sublabel="not assigned to a line" tone="amber" />
      </section>

      <section className="ps-controls" aria-label="Schedule controls">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job, district, or note" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
        <select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}>
          <option value="all">All lines</option>
          {LINES.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
          <option value={QUEUE}>Queue</option>
        </select>
        <label className="ps-zoom">
          Zoom
          <input min="2" max="8" type="range" value={dayPx} onChange={(event) => setDayPx(Number(event.target.value))} />
        </label>
      </section>

      <div className="ps-workspace">
        <section className="ps-board" aria-label="Four line schedule">
          <div className="ps-line-labels" style={{ paddingTop: HEADER_H }}>
            {LINES.map((line) => {
              const util = lineUtilization.find((item) => item.line === line.id);
              return (
                <div className="ps-line-label" key={line.id}>
                  <strong>{line.name}</strong>
                  <span>{line.focus}</span>
                  <small>
                    {util.utilization}% used · {util.modules} modules
                  </small>
                  <div className="ps-meter">
                    <i style={{ width: `${util.utilization}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ps-timeline" ref={gridRef} onMouseDown={onGridMouseDown}>
            <div className="ps-canvas" style={{ width: totalWidth, height: HEADER_H + LINE_IDS.length * ROW_H }}>
              {monthTicks.map((month) => (
                <div className="ps-month" key={month.label} style={{ left: month.x, width: month.width }}>
                  {month.label}
                </div>
              ))}
              {todayX !== null && <div className="ps-today" style={{ left: todayX }} />}
              {LINE_IDS.map((line, index) => (
                <div className="ps-row" key={line} style={{ top: HEADER_H + index * ROW_H }} />
              ))}
              {overlaps.map((overlap, index) => (
                <div
                  className="ps-overlap"
                  key={`${overlap.line}-${overlap.start}-${index}`}
                  style={{
                    top: HEADER_H + LINE_IDS.indexOf(overlap.line) * ROW_H + 12,
                    left: dateToX(overlap.start),
                    width: dateDiffDays(overlap.start, overlap.end) * dayPx,
                  }}
                />
              ))}
              {drawing && (
                <div
                  className="ps-drawing"
                  style={{
                    top: HEADER_H + LINE_IDS.indexOf(drawing.line) * ROW_H + 16,
                    left: Math.min(drawing.startX, drawing.currentX),
                    width: Math.max(8, Math.abs(drawing.currentX - drawing.startX)),
                  }}
                />
              )}
              {scheduledJobs.map((job) => {
                const lineIndex = LINE_IDS.indexOf(job.line);
                const hasOverlap = overlaps.some((overlap) => overlap.jobs.includes(job.id));
                const late = job.end > job.due;
                const width = Math.max(22, dateDiffDays(job.start, job.end) * dayPx);
                return (
                  <div
                    className={`ps-job ${selectedId === job.id ? "is-selected" : ""} ${hasOverlap ? "has-overlap" : ""}`}
                    key={job.id}
                    style={{
                      top: HEADER_H + lineIndex * ROW_H + 16,
                      left: dateToX(job.start),
                      width,
                      background: job.color,
                    }}
                    title={`${job.name}\n${job.start} to ${job.end}\n${job.modules} modules`}
                    onMouseDown={(event) => startDrag(event, job.id)}
                  >
                    <span>{job.name}</span>
                    <small>{job.modules} modules · {job.progress}%</small>
                    <b style={{ width: `${job.progress}%` }} />
                    {(hasOverlap || late) && <em>{hasOverlap ? "!" : "Late"}</em>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="ps-side">
          <section className="ps-panel">
            <div className="ps-panel-head">
              <h2>Job Details</h2>
              {selectedJob && <StatusChip status={selectedJob.status} />}
            </div>
            {selectedJob ? (
              <div className="ps-editor">
                <label>
                  Project
                  <input value={selectedJob.name} onChange={(event) => updateJob(selectedJob.id, { name: event.target.value })} />
                </label>
                <label>
                  District / client
                  <input value={selectedJob.client} onChange={(event) => updateJob(selectedJob.id, { client: event.target.value })} />
                </label>
                <div className="ps-two">
                  <label>
                    Line
                    <select value={selectedJob.line} onChange={(event) => updateJob(selectedJob.id, { line: event.target.value })}>
                      {LINES.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.name}
                        </option>
                      ))}
                      <option value={QUEUE}>Queue</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select value={selectedJob.status} onChange={(event) => updateJob(selectedJob.id, { status: event.target.value })}>
                      {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="ps-two">
                  <label>
                    Start
                    <input type="date" value={selectedJob.start} onChange={(event) => updateJob(selectedJob.id, { start: event.target.value })} />
                  </label>
                  <label>
                    End
                    <input type="date" value={selectedJob.end} onChange={(event) => updateJob(selectedJob.id, { end: event.target.value })} />
                  </label>
                </div>
                <div className="ps-two">
                  <label>
                    Due
                    <input type="date" value={selectedJob.due} onChange={(event) => updateJob(selectedJob.id, { due: event.target.value })} />
                  </label>
                  <label>
                    Color
                    <input type="color" value={selectedJob.color} onChange={(event) => updateJob(selectedJob.id, { color: event.target.value })} />
                  </label>
                </div>
                <div className="ps-three">
                  <label>
                    Modules
                    <input type="number" min="1" value={selectedJob.modules} onChange={(event) => updateJob(selectedJob.id, { modules: Number(event.target.value) })} />
                  </label>
                  <label>
                    Crew
                    <input type="number" min="1" value={selectedJob.crew} onChange={(event) => updateJob(selectedJob.id, { crew: Number(event.target.value) })} />
                  </label>
                  <label>
                    Progress
                    <input type="number" min="0" max="100" value={selectedJob.progress} onChange={(event) => updateJob(selectedJob.id, { progress: Number(event.target.value) })} />
                  </label>
                </div>
                <label>
                  Priority
                  <select value={selectedJob.priority} onChange={(event) => updateJob(selectedJob.id, { priority: event.target.value })}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
                <fieldset className="ps-readiness">
                  <legend>Production readiness</legend>
                  {[
                    ["drawings", "Drawings"],
                    ["materials", "Materials"],
                    ["permits", "Permits"],
                    ["inspections", "QA plan"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={selectedJob.readiness[key]}
                        onChange={(event) =>
                          updateJob(selectedJob.id, {
                            readiness: { ...selectedJob.readiness, [key]: event.target.checked },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <label>
                  Notes
                  <textarea value={selectedJob.notes} onChange={(event) => updateJob(selectedJob.id, { notes: event.target.value })} />
                </label>
                <div className="ps-editor-actions">
                  <Button tone="quiet" onClick={duplicateSelected}>
                    Duplicate
                  </Button>
                  <Button tone="danger" onClick={deleteSelected}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <p className="ps-empty">Select a job, drag across a line to create one, or add a job from the top bar.</p>
            )}
          </section>

          <section className="ps-panel">
            <h2>Risks & Conflicts</h2>
            <div className="ps-risk-list">
              {risks.length ? (
                risks.map((risk, index) => (
                  <button key={`${risk.type}-${index}`} type="button" onClick={() => risk.job && setSelectedId(risk.job.id)}>
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

      {toast && <div className="ps-toast">{toast}</div>}
    </main>
  );
}
