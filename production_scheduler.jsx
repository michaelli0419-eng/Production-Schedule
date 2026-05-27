import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const LINES = ["L1", "L2", "L3", "L4"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS_PER_DAY = 8; // working hours
const TOTAL_COLS = DAYS.length * HOURS_PER_DAY; // 56 half-hour slots (each col = 1 hr)
const COL_WIDTH = 48; // px per hour column
const ROW_HEIGHT = 64;
const HEADER_HEIGHT = 56;
const LINE_LABEL_WIDTH = 64;

const JOB_COLORS = [
  { bg: "#FF6B35", border: "#E55A24", text: "#fff", label: "Type A" },
  { bg: "#3B82F6", border: "#2563EB", text: "#fff", label: "Type B" },
  { bg: "#10B981", border: "#059669", text: "#fff", label: "Type C" },
  { bg: "#8B5CF6", border: "#7C3AED", text: "#fff", label: "Type D" },
  { bg: "#F59E0B", border: "#D97706", text: "#fff", label: "Type E" },
  { bg: "#EC4899", border: "#DB2777", text: "#fff", label: "Type F" },
];

const STATUS_CONFIG = {
  forecast: {
    label: "Forecast",
    color: "#64748B",
    bg: "rgba(100,116,139,0.15)",
  },
  approved: {
    label: "Approved",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.15)",
  },
  ready: {
    label: "Ready",
    color: "#10B981",
    bg: "rgba(16,185,129,0.15)",
  },
  hold: {
    label: "Material Hold",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.15)",
  },
  production: {
    label: "In Production",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.15)",
  },
  delayed: {
    label: "Delayed",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.15)",
  },
  complete: {
    label: "Complete",
    color: "#14B8A6",
    bg: "rgba(20,184,166,0.15)",
  },
};

let nextId = 1;
function makeId() { return nextId++; }

function formatDuration(cols) {
  if (cols < 1) return "<1h";
  return cols === 1 ? "1h" : `${cols}h`;
}

function colToLabel(col) {
  const day = Math.floor(col / HOURS_PER_DAY);
  const hour = col % HOURS_PER_DAY;
  const h = 8 + hour;
  return `${h}:00`;
}

function KPI({ label, value }) {
  return (
    <div
      style={{
        background: "#1E2330",
        border: "1px solid #2D3748",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748B",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#F1F5F9",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ProductionScheduler() {
  const [jobs, setJobs] = useState(() => {
    const saved = localStorage.getItem("production-jobs");

    return saved
      ? JSON.parse(saved)
      : [
          {
            id: makeId(),
            line: 0,
            startCol: 0,
            span: 4,
            colorIdx: 0,
            name: "LAUSD Project A",

            status: "production",
            customer: "LAUSD",
            percentComplete: 35,
            productionValue: 2400000,
            targetShipDate: "2026-06-15",
            notes: "Waiting final electrical release",
          },

          {
            id: makeId(),
            line: 1,
            startCol: 5,
            span: 6,
            colorIdx: 1,
            name: "San Diego Modular",

            status: "hold",
            customer: "San Diego USD",
            percentComplete: 10,
            productionValue: 1800000,
            targetShipDate: "2026-06-28",
            notes: "Material delay on switchgear",
          },

          {
            id: makeId(),
            line: 2,
            startCol: 12,
            span: 5,
            colorIdx: 2,
            name: "Charter School Phase 1",

            status: "forecast",
            customer: "Bright Future Academy",
            percentComplete: 0,
            productionValue: 3200000,
            targetShipDate: "2026-07-10",
            notes: "Pending contract execution",
          },
        ];
  });

  const [dragging, setDragging] = useState(null); // { jobId, type: 'move'|'resize-left'|'resize-right', startX, origStartCol, origSpan }
  const [adding, setAdding] = useState(null); // { line, startCol, currentCol }
  const [selectedJob, setSelectedJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null); // { id, name, colorIdx }
  const [modal, setModal] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [newJobColor, setNewJobColor] = useState(0);
  const [pendingAdd, setPendingAdd] = useState(null); // { line, startCol, span }

  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const addingRef = useRef(null);
  const jobsRef = useRef(jobs);
  const frameRef = useRef(null);
  const pendingPointerRef = useRef(null);
  dragRef.current = dragging;
  addingRef.current = adding;
  jobsRef.current = jobs;

  const conflictSummary = useMemo(() => {
    const conflictJobIds = new Set();
    const conflictPairs = [];
    const jobById = new Map(jobs.map(j => [j.id, j]));
    for (const line of LINES.map((_, idx) => idx)) {
      const onLine = jobs
        .filter(j => j.line === line)
        .slice()
        .sort((a, b) => a.startCol - b.startCol);

      for (let i = 0; i < onLine.length; i++) {
        const a = onLine[i];
        const aEnd = a.startCol + a.span; // end is exclusive
        for (let k = i + 1; k < onLine.length; k++) {
          const b = onLine[k];
          // Since sorted by startCol, once b starts at/after a ends, no further overlaps with a.
          if (b.startCol >= aEnd) break;

          const bEnd = b.startCol + b.span;
          const overlaps = Math.max(a.startCol, b.startCol) < Math.min(aEnd, bEnd); // positive intersection
          if (overlaps) {
            conflictJobIds.add(a.id);
            conflictJobIds.add(b.id);
            const overlapStart = Math.max(a.startCol, b.startCol);
            const overlapEnd = Math.min(aEnd, bEnd);
            conflictPairs.push({
              line,
              aId: a.id,
              bId: b.id,
              overlapStartCol: overlapStart,
              overlapSpan: overlapEnd - overlapStart,
              aName: jobById.get(a.id)?.name ?? "Job",
              bName: jobById.get(b.id)?.name ?? "Job",
            });
          }
        }
      }
    }
    return {
      conflictJobIds,
      conflictPairs,
      conflictCount: conflictPairs.length,
      conflictingJobCount: conflictJobIds.size,
    };
  }, [jobs]);

  const kpis = useMemo(() => {
    const totalSlots = LINES.length * TOTAL_COLS;

    const usedSlots = jobs.reduce(
      (sum, j) => sum + j.span,
      0
    );

    const utilization = Math.round(
      (usedSlots / totalSlots) * 100
    );

    const delayedProjects = jobs.filter(
      j => j.status === "delayed"
    ).length;

    const materialHoldProjects = jobs.filter(
      j => j.status === "hold"
    ).length;

    const activeProjects = jobs.filter(
      j => j.status === "production"
    ).length;

    return {
      utilization,
      delayedProjects,
      materialHoldProjects,
      activeProjects,
    };
  }, [jobs]);

  const getGridPosition = useCallback((clientX, clientY) => {
    if (!gridRef.current) return { col: 0, line: 0 };
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      col: Math.max(0, Math.min(TOTAL_COLS - 1, Math.floor(x / COL_WIDTH))),
      line: Math.max(0, Math.min(LINES.length - 1, Math.floor(y / ROW_HEIGHT))),
    };
  }, []);

  // --- Mouse handlers ---
  const onGridMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (dragging) return;
    const { col, line } = getGridPosition(e.clientX, e.clientY);

    // Check if clicking on a job
    const clickedJob = jobs.find(j =>
      j.line === line && col >= j.startCol && col < j.startCol + j.span
    );
    if (clickedJob) {
      setSelectedJob(clickedJob.id);
      return;
    }

    setSelectedJob(null);
    setAdding({ line, startCol: col, currentCol: col, startedAtX: e.clientX, startedAtY: e.clientY, hasDragged: false });
    e.preventDefault();
  }, [dragging, jobs, getGridPosition]);

  const flushPointerMove = useCallback(() => {
    frameRef.current = null;
    const evt = pendingPointerRef.current;
    if (!evt) return;
    pendingPointerRef.current = null;

    const currentDrag = dragRef.current;
    if (currentDrag) {
      const { col, line } = getGridPosition(evt.clientX, evt.clientY);
      const delta = col - currentDrag.startCol;
      const lineDelta = line - currentDrag.startLine;

      setJobs(prev => prev.map(j => {
        if (j.id !== currentDrag.jobId) return j;
        if (currentDrag.type === "move") {
          const newStart = Math.max(0, Math.min(TOTAL_COLS - j.span, currentDrag.origStartCol + delta));
          const newLine = Math.max(0, Math.min(LINES.length - 1, currentDrag.origLine + lineDelta));
          return { ...j, startCol: newStart, line: newLine };
        }
        if (currentDrag.type === "resize-right") {
          const newSpan = Math.max(1, Math.min(TOTAL_COLS - j.startCol, currentDrag.origSpan + delta));
          return { ...j, span: newSpan };
        }
        if (currentDrag.type === "resize-left") {
          const newStart = Math.max(0, Math.min(currentDrag.origStartCol + currentDrag.origSpan - 1, currentDrag.origStartCol + delta));
          const newSpan = currentDrag.origSpan - (newStart - currentDrag.origStartCol);
          return { ...j, startCol: newStart, span: Math.max(1, newSpan) };
        }
        return j;
      }));
    }

    const currentAdding = addingRef.current;
    if (currentAdding) {
      const { col } = getGridPosition(evt.clientX, evt.clientY);
      const movedEnough = Math.abs(evt.clientX - currentAdding.startedAtX) > 4 || Math.abs(evt.clientY - currentAdding.startedAtY) > 4;
      setAdding(a => ({ ...a, currentCol: col, hasDragged: a.hasDragged || movedEnough }));
    }
  }, [getGridPosition]);

  const onMouseMove = useCallback((e) => {
    if (!dragRef.current && !addingRef.current) return;
    pendingPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (frameRef.current == null) {
      frameRef.current = window.requestAnimationFrame(flushPointerMove);
    }
  }, [flushPointerMove]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      setDragging(null);
      return;
    }
    const currentAdding = addingRef.current;
    if (currentAdding) {
      if (!currentAdding.hasDragged) {
        setAdding(null);
        return;
      }
      const startCol = Math.min(currentAdding.startCol, currentAdding.currentCol);
      const span = Math.max(1, Math.abs(currentAdding.currentCol - currentAdding.startCol) + 1);
      setPendingAdd({ line: currentAdding.line, startCol, span });
      setNewJobName(`Job #${100 + Math.floor(Math.random() * 900)}`);
      setNewJobColor(Math.floor(Math.random() * JOB_COLORS.length));
      setModal(true);
      setAdding(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [onMouseMove, onMouseUp]);

  useEffect(() => {
    localStorage.setItem(
      "production-jobs",
      JSON.stringify(jobs)
    );
  }, [jobs]);

  const startDrag = (e, jobId, type) => {
    e.stopPropagation();
    e.preventDefault();
    const job = jobsRef.current.find(j => j.id === jobId);
    const { col, line } = getGridPosition(e.clientX, e.clientY);
    setDragging({ jobId, type, startCol: col, startLine: line, origStartCol: job.startCol, origLine: job.line, origSpan: job.span });
  };

  const confirmAdd = () => {
    if (!pendingAdd) return;
    setJobs(prev => [...prev, {
      id: makeId(),
      line: pendingAdd.line,
      startCol: pendingAdd.startCol,
      span: pendingAdd.span,
      colorIdx: newJobColor,
      name: newJobName || "New Job",
      status: "forecast",
      customer: "",
      percentComplete: 0,
      productionValue: null,
      targetShipDate: "",
      notes: "",
    }]);
    setModal(false);
    setPendingAdd(null);
  };

  const deleteJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelectedJob(null);
  };

  const openEdit = (job) => {
    setEditingJob({ id: job.id, name: job.name, colorIdx: job.colorIdx });
  };

  const confirmEdit = () => {
    setJobs(prev => prev.map(j => j.id === editingJob.id
      ? { ...j, name: editingJob.name, colorIdx: editingJob.colorIdx }
      : j));
    setEditingJob(null);
  };

  // Ghost block while drawing
  const ghostBlock = adding ? (() => {
    const startCol = Math.min(adding.startCol, adding.currentCol);
    const span = Math.max(1, Math.abs(adding.currentCol - adding.startCol) + 1);
    return { line: adding.line, startCol, span };
  })() : null;

  const totalWidth = TOTAL_COLS * COL_WIDTH;

  return (
    <div style={{
      fontFamily: "'DM Mono', 'Fira Mono', monospace",
      background: "#0F1117",
      minHeight: "100vh",
      color: "#E2E8F0",
      padding: "24px",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#64748B", textTransform: "uppercase", marginBottom: 4 }}>
            Production Schedule
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#F1F5F9", letterSpacing: -0.5 }}>
            Weekly Planner
          </h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {JOB_COLORS.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94A3B8" }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: c.bg }} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <KPI
          label="Factory Utilization"
          value={`${kpis.utilization}%`}
        />

        <KPI
          label="Active Projects"
          value={kpis.activeProjects}
        />

        <KPI
          label="Material Holds"
          value={kpis.materialHoldProjects}
        />

        <KPI
          label="Delayed"
          value={kpis.delayedProjects}
        />
      </div>

      {/* Instruction bar */}
      <div style={{
        background: "#1E2330", border: "1px solid #2D3748", borderRadius: 8,
        padding: "8px 16px", marginBottom: 16, fontSize: 12, color: "#64748B",
        display: "flex", gap: 24
      }}>
        <span>🖱 <b style={{ color: "#94A3B8" }}>Drag on grid</b> to add a job</span>
        <span>↔ <b style={{ color: "#94A3B8" }}>Drag block edges</b> to resize</span>
        <span>✋ <b style={{ color: "#94A3B8" }}>Drag block center</b> to move</span>
        <span>🖊 <b style={{ color: "#94A3B8" }}>Click block</b> to edit / delete</span>
      </div>

      {/* Conflicts summary */}
      <div style={{
        background: "#1E2330", border: "1px solid #2D3748", borderRadius: 8,
        padding: "8px 16px", marginBottom: 16, fontSize: 12, color: "#64748B",
      }}>
        {conflictSummary.conflictCount === 0 ? (
          <span>No conflicts detected.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span><b style={{ color: "#FBBF24" }}>Conflicts</b>: {conflictSummary.conflictCount} overlap(s)</span>
              <span style={{ color: "#64748B" }}>Jobs flagged: {conflictSummary.conflictingJobCount}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {conflictSummary.conflictPairs.slice(0, 4).map((p, idx) => (
                <span
                  key={`${p.aId}-${p.bId}-${idx}`}
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    color: "#FBBF24",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                  title={`Overlaps on ${LINES[p.line]} around ${colToLabel(p.overlapStartCol)}`}
                >
                  {LINES[p.line]}: {p.aName} & {p.bName}
                </span>
              ))}
              {conflictSummary.conflictCount > 4 && (
                <span style={{ color: "#64748B", fontSize: 11 }}>
                  +{conflictSummary.conflictCount - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Gantt */}
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #2D3748" }}>
        <div style={{ display: "flex", minWidth: LINE_LABEL_WIDTH + totalWidth }}>

          {/* Line labels column */}
          <div style={{ width: LINE_LABEL_WIDTH, flexShrink: 0, background: "#161B27" }}>
            {/* Corner */}
            <div style={{ height: HEADER_HEIGHT, borderBottom: "1px solid #2D3748", borderRight: "1px solid #2D3748" }} />
            {LINES.map((l, i) => (
              <div key={l} style={{
                height: ROW_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, color: "#CBD5E1", letterSpacing: 1,
                borderBottom: i < LINES.length - 1 ? "1px solid #2D3748" : "none",
                borderRight: "1px solid #2D3748",
              }}>
                {l}
              </div>
            ))}
          </div>

          {/* Grid area */}
          <div style={{ position: "relative", flex: 1 }}>
            {/* Day headers */}
            <div style={{ display: "flex", height: HEADER_HEIGHT, background: "#161B27", borderBottom: "1px solid #2D3748" }}>
              {DAYS.map((day, di) => (
                <div key={day} style={{
                  width: HOURS_PER_DAY * COL_WIDTH, flexShrink: 0,
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  borderRight: di < DAYS.length - 1 ? "1px solid #2D3748" : "none",
                  padding: "0 8px 4px",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: di < 5 ? "#CBD5E1" : "#64748B" }}>
                    {day}
                  </div>
                  <div style={{ display: "flex" }}>
                    {Array.from({ length: HOURS_PER_DAY }).map((_, h) => (
                      <div key={h} style={{
                        width: COL_WIDTH, fontSize: 9, color: "#475569",
                        textAlign: "left", paddingLeft: 2,
                      }}>
                        {8 + h}h
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid rows */}
            <div
              ref={gridRef}
              style={{ position: "relative", cursor: dragging ? "grabbing" : "crosshair", touchAction: "none" }}
              onMouseDown={onGridMouseDown}
            >
              {/* Row backgrounds + grid lines */}
              {LINES.map((l, li) => (
                <div key={l} style={{
                  display: "flex", height: ROW_HEIGHT,
                  borderBottom: li < LINES.length - 1 ? "1px solid #1E2330" : "none",
                }}>
                  {Array.from({ length: TOTAL_COLS }).map((_, ci) => {
                    const isDay = ci % HOURS_PER_DAY === 0;
                    const isWeekend = Math.floor(ci / HOURS_PER_DAY) >= 5;
                    return (
                      <div key={ci} style={{
                        width: COL_WIDTH, flexShrink: 0,
                        background: isWeekend ? "#131620" : (li % 2 === 0 ? "#0F1117" : "#111420"),
                        borderLeft: isDay ? "1px solid #2D3748" : "1px solid #181E2C",
                        height: "100%",
                      }} />
                    );
                  })}
                </div>
              ))}

              {/* Ghost block while drawing */}
              {ghostBlock && (
                <div style={{
                  position: "absolute",
                  top: ghostBlock.line * ROW_HEIGHT + 6,
                  left: ghostBlock.startCol * COL_WIDTH + 2,
                  width: ghostBlock.span * COL_WIDTH - 4,
                  height: ROW_HEIGHT - 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "2px dashed #64748B",
                  borderRadius: 6,
                  pointerEvents: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#94A3B8",
                }}>
                  {formatDuration(ghostBlock.span)}
                </div>
              )}

              {/* Job blocks */}
              {jobs.map(job => {
                const color = JOB_COLORS[job.colorIdx] || JOB_COLORS[0];
                const isSelected = selectedJob === job.id;
                const isDraggingThis = dragging?.jobId === job.id;
                const isConflict = conflictSummary.conflictJobIds.has(job.id);
                const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.forecast;
                return (
                  <div
                    key={job.id}
                    title={`
${job.name}

Customer: ${job.customer}

Status: ${STATUS_CONFIG[job.status]?.label ?? STATUS_CONFIG.forecast.label}

Completion: ${job.percentComplete}%

Ship Date: ${job.targetShipDate}

Value: $${job.productionValue?.toLocaleString()}
`}
                    style={{
                      position: "absolute",
                      top: job.line * ROW_HEIGHT + 5,
                      left: job.startCol * COL_WIDTH + 2,
                      width: job.span * COL_WIDTH - 4,
                      height: ROW_HEIGHT - 10,
                      background: color.bg,
                      border: `2px solid ${
                        isSelected ? "#FFF" : isConflict ? "#F59E0B" : color.border
                      }`,
                      borderRadius: 7,
                      display: "flex", alignItems: "center",
                      boxShadow: isSelected
                        ? `0 0 0 3px rgba(255,255,255,0.3), 0 4px 16px rgba(0,0,0,0.4)`
                        : isConflict
                          ? "0 0 0 3px rgba(245,158,11,0.35), 0 10px 30px rgba(0,0,0,0.45)"
                          : isDraggingThis
                            ? "0 8px 24px rgba(0,0,0,0.5)"
                            : "0 2px 8px rgba(0,0,0,0.3)",
                      cursor: dragging?.jobId === job.id ? "grabbing" : "grab",
                      transition: isDraggingThis ? "none" : "box-shadow 0.15s",
                      zIndex: isSelected || isDraggingThis ? 10 : 2,
                      overflow: "hidden",
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedJob(job.id); }}
                  >
                    {isConflict && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 8,
                          background: "rgba(245,158,11,0.18)",
                          border: "1px solid rgba(245,158,11,0.7)",
                          color: "#FBBF24",
                          fontSize: 10,
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: 999,
                          pointerEvents: "none",
                        }}
                        title="Overlaps with another job on the same line"
                      >
                        Conflict
                      </div>
                    )}

                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 999,
                        background: status.bg,
                        color: status.color,
                        border: `1px solid ${status.color}`,
                        pointerEvents: "none",
                      }}
                    >
                      {status.label}
                    </div>

                    {/* Left resize handle */}
                    <div
                      style={{
                        width: 8, height: "100%", cursor: "ew-resize",
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        opacity: 0.6,
                      }}
                      onMouseDown={(e) => startDrag(e, job.id, "resize-left")}
                    >
                      <div style={{ width: 2, height: 16, background: color.text, borderRadius: 2, opacity: 0.6 }} />
                    </div>

                    {/* Content */}
                    <div
                      style={{ flex: 1, overflow: "hidden", padding: "0 4px", cursor: "grab" }}
                      onMouseDown={(e) => startDrag(e, job.id, "move")}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {job.name}
                      </div>
                      <div style={{ fontSize: 10, color: color.text, opacity: 0.75 }}>
                        {formatDuration(job.span)}
                      </div>
                    </div>

                    {/* Right resize handle */}
                    <div
                      style={{
                        width: 8, height: "100%", cursor: "ew-resize",
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseDown={(e) => startDrag(e, job.id, "resize-right")}
                    >
                      <div style={{ width: 2, height: 16, background: color.text, borderRadius: 2, opacity: 0.6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected job toolbar */}
      {selectedJob && (() => {
        const job = jobs.find(j => j.id === selectedJob);
        if (!job) return null;
        const color = JOB_COLORS[job.colorIdx];
        return (
          <div style={{
            marginTop: 16, background: "#1E2330", border: "1px solid #2D3748",
            borderRadius: 10, padding: "12px 20px",
            display: "flex", alignItems: "center", gap: 20,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color.bg, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>{job.name}</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                {LINES[job.line]} · {DAYS[Math.floor(job.startCol / HOURS_PER_DAY)]} {colToLabel(job.startCol)} → {DAYS[Math.min(6, Math.floor((job.startCol + job.span - 1) / HOURS_PER_DAY))]} {colToLabel(job.startCol + job.span)} · {formatDuration(job.span)}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => openEdit(job)}
              style={{
                background: "#2D3748", border: "none", borderRadius: 6,
                color: "#CBD5E1", padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>
              Edit
            </button>
            <button
              onClick={() => deleteJob(job.id)}
              style={{
                background: "#7F1D1D", border: "none", borderRadius: 6,
                color: "#FCA5A5", padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>
              Delete
            </button>
            <button
              onClick={() => setSelectedJob(null)}
              style={{
                background: "transparent", border: "1px solid #2D3748", borderRadius: 6,
                color: "#64748B", padding: "6px 10px", cursor: "pointer", fontSize: 12,
              }}>
              ✕
            </button>
          </div>
        );
      })()}

      {/* Add job modal */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}
          onClick={() => { setModal(false); setPendingAdd(null); }}>
          <div
            style={{
              background: "#1E2330", border: "1px solid #334155", borderRadius: 14,
              padding: 28, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>
              Add Job Block
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 4 }}>JOB NAME</label>
              <input
                autoFocus
                value={newJobName}
                onChange={e => setNewJobName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmAdd()}
                style={{
                  width: "100%", background: "#0F1117", border: "1px solid #2D3748",
                  borderRadius: 7, padding: "8px 12px", color: "#F1F5F9", fontSize: 14,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 8 }}>JOB TYPE / COLOR</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {JOB_COLORS.map((c, i) => (
                  <button key={i} onClick={() => setNewJobColor(i)} style={{
                    background: c.bg, border: newJobColor === i ? "3px solid #FFF" : "3px solid transparent",
                    borderRadius: 6, width: 32, height: 32, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700,
                  }}>
                    {newJobColor === i ? "✓" : ""}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>{JOB_COLORS[newJobColor]?.label}</div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setModal(false); setPendingAdd(null); }} style={{
                background: "transparent", border: "1px solid #2D3748", borderRadius: 7,
                color: "#94A3B8", padding: "8px 18px", cursor: "pointer", fontSize: 13,
              }}>
                Cancel
              </button>
              <button onClick={confirmAdd} style={{
                background: JOB_COLORS[newJobColor].bg, border: "none", borderRadius: 7,
                color: "#fff", padding: "8px 22px", cursor: "pointer", fontSize: 13, fontWeight: 700,
              }}>
                Add Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit job modal */}
      {editingJob && (() => {
        const job = jobs.find(j => j.id === editingJob.id);
        return (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
            onClick={() => setEditingJob(null)}>
            <div style={{
              background: "#1E2330", border: "1px solid #334155", borderRadius: 14,
              padding: 28, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", marginBottom: 20 }}>Edit Job</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 4 }}>JOB NAME</label>
                <input
                  autoFocus
                  value={editingJob.name}
                  onChange={e => setEditingJob(j => ({ ...j, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && confirmEdit()}
                  style={{
                    width: "100%", background: "#0F1117", border: "1px solid #2D3748",
                    borderRadius: 7, padding: "8px 12px", color: "#F1F5F9", fontSize: 14,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 8 }}>JOB TYPE / COLOR</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {JOB_COLORS.map((c, i) => (
                    <button key={i} onClick={() => setEditingJob(j => ({ ...j, colorIdx: i }))} style={{
                      background: c.bg, border: editingJob.colorIdx === i ? "3px solid #FFF" : "3px solid transparent",
                      borderRadius: 6, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700,
                    }}>
                      {editingJob.colorIdx === i ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setEditingJob(null)} style={{
                  background: "transparent", border: "1px solid #2D3748", borderRadius: 7,
                  color: "#94A3B8", padding: "8px 18px", cursor: "pointer", fontSize: 13,
                }}>
                  Cancel
                </button>
                <button onClick={confirmEdit} style={{
                  background: JOB_COLORS[editingJob.colorIdx].bg, border: "none", borderRadius: 7,
                  color: "#fff", padding: "8px 22px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
