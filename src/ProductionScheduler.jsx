import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const LINES = ["L1", "L2", "L3", "L4"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YEAR = 2026;
const ROW_HEIGHT = 56;
const SUBROW_HEIGHT = 20; // "line" label row
const TOTAL_ROW = ROW_HEIGHT + SUBROW_HEIGHT;
const HEADER_H = 64;
const LABEL_W = 72;
const DAY_PX = 3; // pixels per day
const TODAY = new Date();

const JOB_COLORS = [
  "#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#EC4899","#06B6D4","#84CC16","#F97316","#6366F1",
  "#14B8A6","#E11D48","#0EA5E9","#A3E635","#FB923C",
  "#C084FC","#34D399","#FBBF24","#60A5FA","#4ADE80",
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function dateToX(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  const jan1 = new Date(YEAR, 0, 1);
  return Math.max(0, Math.floor((d - jan1) / 86400000)) * DAY_PX;
}

function xToDate(x) {
  const jan1 = new Date(YEAR, 0, 1);
  const days = Math.round(x / DAY_PX);
  const d = new Date(jan1.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function totalYearDays() {
  let d = 0;
  for (let m = 0; m < 12; m++) d += getDaysInMonth(YEAR, m);
  return d;
}

const TOTAL_DAYS = totalYearDays();
const TOTAL_W = TOTAL_DAYS * DAY_PX;

function dateDiffDays(start, end) {
  return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return !(aEnd < bStart || aStart > bEnd);
}

function resolveDropOverlap(allJobs, movingJobId) {
  const moving = allJobs.find((j) => j.id === movingJobId);
  if (!moving) return allJobs;

  const duration = dateDiffDays(moving.start, moving.end) - 1;
  const peers = allJobs.filter((j) => j.id !== movingJobId && j.line === moving.line);

  let nextStart = moving.start;
  let nextEnd = moving.end;
  let bumped = true;

  // Keep pushing right until the moved block no longer overlaps peers.
  while (bumped) {
    bumped = false;
    for (const peer of peers) {
      if (rangesOverlap(nextStart, nextEnd, peer.start, peer.end)) {
        nextStart = addDays(peer.end, 1);
        nextEnd = addDays(nextStart, duration);
        bumped = true;
      }
    }
  }

  return allJobs.map((j) =>
    j.id === movingJobId ? { ...j, start: nextStart, end: nextEnd } : j
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, j) => obj[h] = vals[j] || "");
    return obj;
  }).filter(r => r.job_name && r.line && r.start_date && r.end_date);
}

function jobsToCSV(jobs) {
  const headers = ["id","job_name","line","start_date","end_date","color","notes"];
  const rows = jobs.map(j =>
    [j.id, j.name, j.line, j.start, j.end, j.color, (j.notes||"").replace(/,/g," ")].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function csvRowToJob(row, idx) {
  return {
    id: row.id || String(Date.now() + idx),
    name: row.job_name || "Job",
    line: row.line || "L1",
    start: row.start_date,
    end: row.end_date,
    color: row.color || JOB_COLORS[idx % JOB_COLORS.length],
    notes: row.notes || "",
  };
}

// ─── Sample data ──────────────────────────────────────────────────────────────
const SAMPLE_JOBS = [
  {id:"1",name:"#101 Batch A",line:"L1",start:"2026-01-05",end:"2026-01-18",color:"#3B82F6",notes:""},
  {id:"2",name:"#102",        line:"L1",start:"2026-01-22",end:"2026-01-28",color:"#EC4899",notes:""},
  {id:"3",name:"#103 Run",    line:"L1",start:"2026-02-02",end:"2026-02-12",color:"#3B82F6",notes:""},
  {id:"4",name:"#104",        line:"L1",start:"2026-02-16",end:"2026-02-20",color:"#3B82F6",notes:""},
  {id:"5",name:"#105",        line:"L1",start:"2026-02-24",end:"2026-03-10",color:"#EF4444",notes:""},
  {id:"6",name:"#106 Prod",   line:"L1",start:"2026-03-14",end:"2026-03-22",color:"#8B5CF6",notes:""},
  {id:"7",name:"#107",        line:"L1",start:"2026-04-01",end:"2026-04-14",color:"#10B981",notes:""},
  {id:"8",name:"#108 Long Run",line:"L1",start:"2026-05-01",end:"2026-06-14",color:"#F59E0B",notes:""},
  {id:"9",name:"#109",        line:"L1",start:"2026-06-20",end:"2026-07-10",color:"#06B6D4",notes:""},
  {id:"10",name:"#110",       line:"L1",start:"2026-07-15",end:"2026-07-28",color:"#06B6D4",notes:""},
  {id:"11",name:"#111",       line:"L1",start:"2026-08-01",end:"2026-08-15",color:"#3B82F6",notes:""},
  {id:"12",name:"#112 Batch", line:"L1",start:"2026-08-20",end:"2026-09-05",color:"#3B82F6",notes:""},
  {id:"13",name:"#113",       line:"L1",start:"2026-09-10",end:"2026-09-20",color:"#F59E0B",notes:""},
  {id:"14",name:"#114 Yellow",line:"L1",start:"2026-09-25",end:"2026-11-10",color:"#F59E0B",notes:""},

  {id:"20",name:"#201",       line:"L2",start:"2026-01-03",end:"2026-01-08",color:"#84CC16",notes:""},
  {id:"21",name:"#202 Mix",   line:"L2",start:"2026-01-12",end:"2026-01-22",color:"#F97316",notes:""},
  {id:"22",name:"#203",       line:"L2",start:"2026-02-01",end:"2026-02-05",color:"#06B6D4",notes:""},
  {id:"23",name:"#204",       line:"L2",start:"2026-02-07",end:"2026-02-12",color:"#C084FC",notes:""},
  {id:"24",name:"#205 Ext",   line:"L2",start:"2026-03-01",end:"2026-04-01",color:"#10B981",notes:""},
  {id:"25",name:"#206",       line:"L2",start:"2026-04-10",end:"2026-04-20",color:"#10B981",notes:""},
  {id:"26",name:"#207",       line:"L2",start:"2026-04-25",end:"2026-05-08",color:"#F59E0B",notes:""},
  {id:"27",name:"#208",       line:"L2",start:"2026-05-12",end:"2026-05-22",color:"#10B981",notes:""},

  {id:"30",name:"#301",       line:"L3",start:"2026-01-02",end:"2026-01-10",color:"#84CC16",notes:""},
  {id:"31",name:"#302 Pink",  line:"L3",start:"2026-01-14",end:"2026-02-02",color:"#EC4899",notes:""},
  {id:"32",name:"#303",       line:"L3",start:"2026-02-05",end:"2026-02-08",color:"#06B6D4",notes:""},
  {id:"33",name:"#304 Gray",  line:"L3",start:"2026-02-12",end:"2026-04-20",color:"#94A3B8",notes:""},
  {id:"34",name:"#305",       line:"L3",start:"2026-05-01",end:"2026-05-10",color:"#06B6D4",notes:""},
  {id:"35",name:"#306 Peach", line:"L3",start:"2026-05-14",end:"2026-06-05",color:"#FB923C",notes:""},
  {id:"36",name:"#307",       line:"L3",start:"2026-06-15",end:"2026-06-20",color:"#3B82F6",notes:""},
  {id:"37",name:"#308",       line:"L3",start:"2026-06-25",end:"2026-07-05",color:"#6366F1",notes:""},
  {id:"38",name:"#309",       line:"L3",start:"2026-07-08",end:"2026-07-18",color:"#F97316",notes:""},
  {id:"39",name:"#310",       line:"L3",start:"2026-07-22",end:"2026-07-28",color:"#F97316",notes:""},
  {id:"40",name:"#311",       line:"L3",start:"2026-08-03",end:"2026-08-06",color:"#EF4444",notes:""},
  {id:"41",name:"#312 Navy",  line:"L3",start:"2026-08-12",end:"2026-09-05",color:"#1E3A5F",notes:""},
  {id:"42",name:"#313",       line:"L3",start:"2026-09-10",end:"2026-10-10",color:"#10B981",notes:""},
  {id:"43",name:"#314",       line:"L3",start:"2026-10-20",end:"2026-10-28",color:"#EF4444",notes:""},
  {id:"44",name:"#315",       line:"L3",start:"2026-11-01",end:"2026-11-06",color:"#FBBF24",notes:""},
];

let nextId = 1000;

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ProductionScheduler() {
  const [jobs, setJobs] = useState(SAMPLE_JOBS);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [modal, setModal] = useState(null); // {mode:'add'|'edit', job, lineKey}
  const [importError, setImportError] = useState("");
  const [toast, setToast] = useState("");
  const gridRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);
  dragRef.current = dragging;

  // Today marker
  const todayX = useMemo(() => {
    const jan1 = new Date(YEAR, 0, 1);
    const diff = Math.floor((TODAY - jan1) / 86400000);
    return diff * DAY_PX;
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── X pos helpers ──
  function getX(clientX) {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(TOTAL_W - 1, clientX - rect.left + gridRef.current.scrollLeft));
  }

  function getLineFromY(clientY) {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const idx = Math.floor(y / TOTAL_ROW);
    return idx >= 0 && idx < LINES.length ? LINES[idx] : null;
  }

  // ── Grid mouse down ──
  function onGridMouseDown(e) {
    if (e.button !== 0) return;
    if (dragRef.current) return;
    const x = getX(e.clientX);
    const line = getLineFromY(e.clientY);
    if (!line) return;
    const dateStr = xToDate(x);
    // Check if clicking a job
    const hit = jobs.find(j => j.line === line && dateStr >= j.start && dateStr <= j.end);
    if (hit) { setSelected(hit.id); return; }
    setSelected(null);
    setDrawing({ line, startX: x, currentX: x, startDate: dateStr });
    e.preventDefault();
  }

  // ── Global mouse move / up ──
  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (d) {
        const x = getX(e.clientX);
        const delta = Math.round((x - d.startX) / DAY_PX);
        setJobs(prev => prev.map(j => {
          if (j.id !== d.jobId) return j;
          if (d.type === "move") {
            const newStart = addDays(d.origStart, delta);
            const dur = dateDiffDays(d.origStart, d.origEnd) - 1;
            const pointerLine = getLineFromY(e.clientY) || d.origLine;
            return {
              ...j,
              line: pointerLine,
              start: newStart,
              end: addDays(newStart, dur),
            };
          }
          if (d.type === "resize-right") {
            const newEnd = addDays(d.origEnd, delta);
            if (newEnd <= j.start) return j;
            return { ...j, end: newEnd };
          }
          if (d.type === "resize-left") {
            const newStart = addDays(d.origStart, delta);
            if (newStart >= j.end) return j;
            return { ...j, start: newStart };
          }
          return j;
        }));
      }
      if (drawing) {
        const x = getX(e.clientX);
        setDrawing(d => ({ ...d, currentX: x }));
      }
    }
    function onUp(e) {
      if (dragRef.current) {
        const endedDrag = dragRef.current;
        if (endedDrag.type === "move") {
          setJobs((prev) => resolveDropOverlap(prev, endedDrag.jobId));
        }
        setDragging(null);
        return;
      }
      if (drawing) {
        const x = getX(e.clientX);
        const startX = Math.min(drawing.startX, x);
        const endX = Math.max(drawing.startX, x);
        const startDate = xToDate(startX);
        const endDate = xToDate(endX);
        const span = dateDiffDays(startDate, endDate);
        setDrawing(null);
        if (span < 1) return;
        const newJob = {
          id: String(nextId++),
          name: `Job #${nextId}`,
          line: drawing.line,
          start: startDate,
          end: endDate,
          color: JOB_COLORS[Math.floor(Math.random() * JOB_COLORS.length)],
          notes: "",
        };
        setModal({ mode: "add", job: newJob });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drawing]);

  function startDrag(e, jobId, type) {
    e.stopPropagation(); e.preventDefault();
    const job = jobs.find(j => j.id === jobId);
    setDragging({
      jobId,
      type,
      startX: getX(e.clientX),
      origStart: job.start,
      origEnd: job.end,
      origLine: job.line,
    });
  }

  // ── CSV Import ──
  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        const imported = rows.map((r, i) => csvRowToJob(r, i));
        if (!imported.length) throw new Error("No valid rows found");
        setJobs(imported);
        showToast(`✓ Imported ${imported.length} jobs`);
        setImportError("");
      } catch (err) {
        setImportError("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── CSV Export ──
  function exportCSV() {
    const csv = jobsToCSV(jobs);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "production_schedule.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("✓ Exported production_schedule.csv");
  }

  // ── Template CSV download ──
  function downloadTemplate() {
    const tmpl = "id,job_name,line,start_date,end_date,color,notes\n1,Job #101,L1,2026-01-05,2026-01-18,#3B82F6,Sample job\n2,Job #201,L2,2026-02-01,2026-02-15,#10B981,";
    const blob = new Blob([tmpl], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "schedule_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Modal confirm ──
  function confirmModal() {
    const j = modal.job;
    if (!j.name.trim() || !j.start || !j.end) return;
    if (modal.mode === "add") {
      setJobs(prev => [...prev, j]);
    } else {
      setJobs(prev => prev.map(x => x.id === j.id ? j : x));
    }
    setModal(null);
    setSelected(j.id);
  }

  function deleteJob(id) {
    setJobs(prev => prev.filter(j => j.id !== id));
    setSelected(null);
  }

  const selectedJob = jobs.find(j => j.id === selected);

  // Ghost while drawing
  const ghost = drawing ? {
    line: drawing.line,
    startX: Math.min(drawing.startX, drawing.currentX),
    w: Math.max(DAY_PX, Math.abs(drawing.currentX - drawing.startX)),
  } : null;

  // Month tick offsets
  const monthTicks = useMemo(() => {
    let x = 0;
    return MONTHS.map((m, i) => {
      const days = getDaysInMonth(YEAR, i);
      const tick = { label: m, x, w: days * DAY_PX };
      x += days * DAY_PX;
      return tick;
    });
  }, []);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans','Helvetica Neue',sans-serif", background: "#F8F9FB", minHeight: "100vh", color: "#1E293B" }}>
      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Production Schedule</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            {YEAR} · {jobs.length} jobs across {LINES.length} lines
          </div>
        </div>
        <button onClick={() => fileRef.current?.click()} style={btnStyle("#6366F1")}>
          ⬆ Import CSV
        </button>
        <button onClick={exportCSV} style={btnStyle("#10B981")}>
          ⬇ Export CSV
        </button>
        <button onClick={downloadTemplate} style={btnStyle("#64748B")}>
          Template
        </button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onFileChange} />
      </div>

      {importError && (
        <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "8px 24px", fontSize: 12, borderBottom: "1px solid #FECACA" }}>
          {importError}
        </div>
      )}

      {/* ── Instructions ── */}
      <div style={{ padding: "8px 24px", display: "flex", gap: 20, fontSize: 11, color: "#94A3B8", borderBottom: "1px solid #E2E8F0", background: "#fff" }}>
        <span>🖱 <b style={{ color: "#64748B" }}>Drag on empty row</b> to add job</span>
        <span>↔ <b style={{ color: "#64748B" }}>Drag edges</b> to resize</span>
        <span>✋ <b style={{ color: "#64748B" }}>Drag center</b> to move</span>
        <span>🖊 <b style={{ color: "#64748B" }}>Click block</b> to edit</span>
      </div>

      {/* ── Gantt ── */}
      <div style={{ overflowX: "auto", overflowY: "visible" }} ref={gridRef}>
        <div style={{ display: "flex", minWidth: LABEL_W + TOTAL_W }}>

          {/* Line labels */}
          <div style={{ width: LABEL_W, flexShrink: 0, background: "#fff", borderRight: "1px solid #E2E8F0", zIndex: 5, position: "sticky", left: 0 }}>
            <div style={{ height: HEADER_H, borderBottom: "1px solid #E2E8F0" }} />
            {LINES.map((l, i) => (
              <div key={l}>
                <div style={{
                  height: ROW_HEIGHT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: "2px solid #CBD5E1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13, color: "#475569",
                  }}>{l}</div>
                </div>
                <div style={{ height: SUBROW_HEIGHT, display: "flex", alignItems: "center", paddingLeft: 16, fontSize: 10, color: "#CBD5E1" }}>
                  line
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable grid */}
          <div style={{ position: "relative", flex: 1, overflow: "visible" }}>
            {/* Month header */}
            <div style={{ display: "flex", height: HEADER_H, background: "#fff", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0, zIndex: 4 }}>
              {monthTicks.map((m, i) => (
                <div key={m.label} style={{
                  width: m.w, flexShrink: 0,
                  borderRight: "1px solid #E2E8F0",
                  display: "flex", flexDirection: "column", justifyContent: "flex-end",
                  padding: "0 8px 6px",
                }}>
                  <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, letterSpacing: 1 }}>{YEAR}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Row area */}
            <div
              style={{ position: "relative", cursor: dragging ? "grabbing" : "crosshair" }}
              onMouseDown={onGridMouseDown}
            >
              {/* Row backgrounds */}
              {LINES.map((l, li) => (
                <div key={l} style={{ display: "flex", height: TOTAL_ROW }}>
                  {monthTicks.map((m, mi) => (
                    <div key={mi} style={{
                      width: m.w, flexShrink: 0, height: "100%",
                      background: li % 2 === 0 ? "#F8F9FB" : "#fff",
                      borderRight: "1px solid #E9EEF4",
                      borderBottom: li < LINES.length - 1 ? "1px solid #E9EEF4" : "none",
                    }} />
                  ))}
                </div>
              ))}

              {/* Today marker */}
              {todayX >= 0 && todayX <= TOTAL_W && (
                <div style={{
                  position: "absolute", top: 0,
                  left: todayX - 1,
                  width: 2,
                  height: LINES.length * TOTAL_ROW,
                  background: "#EF4444",
                  zIndex: 3,
                  pointerEvents: "none",
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: 4,
                    background: "#EF4444", color: "#fff",
                    fontSize: 9, padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap",
                    fontWeight: 700,
                  }}>TODAY</div>
                </div>
              )}

              {/* Ghost block */}
              {ghost && (
                <div style={{
                  position: "absolute",
                  top: LINES.indexOf(ghost.line) * TOTAL_ROW + 4,
                  left: ghost.startX,
                  width: ghost.w,
                  height: ROW_HEIGHT - 8,
                  background: "rgba(99,102,241,0.15)",
                  border: "2px dashed #6366F1",
                  borderRadius: 5,
                  pointerEvents: "none",
                  zIndex: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#6366F1", fontWeight: 600,
                }}>
                  {Math.max(1, Math.round(ghost.w / DAY_PX))}d
                </div>
              )}

              {/* Job blocks */}
              {jobs.map(job => {
                const lineIdx = LINES.indexOf(job.line);
                if (lineIdx < 0) return null;
                const x = dateToX(job.start);
                const w = Math.max(DAY_PX * 2, dateDiffDays(job.start, job.end) * DAY_PX);
                const isSelected = selected === job.id;
                const isDragging = dragging?.jobId === job.id;
                return (
                  <div
                    key={job.id}
                    style={{
                      position: "absolute",
                      top: lineIdx * TOTAL_ROW + 5,
                      left: x,
                      width: w,
                      height: ROW_HEIGHT - 10,
                      background: job.color,
                      borderRadius: 4,
                      border: isSelected ? "2px solid #1E293B" : "2px solid transparent",
                      boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.15)" : isDragging ? "0 4px 16px rgba(0,0,0,0.2)" : "none",
                      cursor: isDragging ? "grabbing" : "grab",
                      zIndex: isSelected || isDragging ? 10 : 2,
                      display: "flex", alignItems: "center",
                      overflow: "hidden",
                      transition: isDragging ? "none" : "box-shadow 0.1s",
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelected(job.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); setModal({ mode: "edit", job: { ...job } }); }}
                  >
                    {/* Left handle */}
                    <div
                      style={{ width: 6, height: "100%", cursor: "ew-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseDown={e => startDrag(e, job.id, "resize-left")}
                    >
                      <div style={{ width: 1.5, height: 12, background: "rgba(255,255,255,0.5)", borderRadius: 2 }} />
                    </div>

                    {/* Label */}
                    <div
                      style={{ flex: 1, overflow: "hidden", padding: "0 2px", cursor: "grab" }}
                      onMouseDown={e => startDrag(e, job.id, "move")}
                    >
                      {w > 28 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                          {w > 50 ? job.name : ""}
                        </div>
                      )}
                    </div>

                    {/* Right handle */}
                    <div
                      style={{ width: 6, height: "100%", cursor: "ew-resize", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                      onMouseDown={e => startDrag(e, job.id, "resize-right")}
                    >
                      <div style={{ width: 1.5, height: 12, background: "rgba(255,255,255,0.5)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Selected job panel ── */}
      {selectedJob && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1E293B", borderRadius: 12, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          zIndex: 20, minWidth: 400, maxWidth: 640,
        }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: selectedJob.color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>{selectedJob.name}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>
              {selectedJob.line} · {selectedJob.start} → {selectedJob.end} · {dateDiffDays(selectedJob.start, selectedJob.end)}d
              {selectedJob.notes ? ` · ${selectedJob.notes}` : ""}
            </div>
          </div>
          <button onClick={() => setModal({ mode: "edit", job: { ...selectedJob } })} style={btnStyle("#334155")}>Edit</button>
          <button onClick={() => deleteJob(selectedJob.id)} style={btnStyle("#7F1D1D", "#FCA5A5")}>Delete</button>
          <button onClick={() => setSelected(null)} style={{ ...btnStyle("#334155"), padding: "5px 8px" }}>✕</button>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
          onClick={() => setModal(null)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#1E293B" }}>
              {modal.mode === "add" ? "Add Job" : "Edit Job"}
            </div>

            <Field label="Job Name">
              <input value={modal.job.name} onChange={e => setModal(m => ({ ...m, job: { ...m.job, name: e.target.value } }))}
                style={inputStyle} autoFocus onKeyDown={e => e.key === "Enter" && confirmModal()} />
            </Field>

            <Field label="Line">
              <select value={modal.job.line} onChange={e => setModal(m => ({ ...m, job: { ...m.job, line: e.target.value } }))} style={inputStyle}>
                {LINES.map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>

            <div style={{ display: "flex", gap: 12 }}>
              <Field label="Start Date" style={{ flex: 1 }}>
                <input type="date" value={modal.job.start} onChange={e => setModal(m => ({ ...m, job: { ...m.job, start: e.target.value } }))} style={inputStyle} />
              </Field>
              <Field label="End Date" style={{ flex: 1 }}>
                <input type="date" value={modal.job.end} onChange={e => setModal(m => ({ ...m, job: { ...m.job, end: e.target.value } }))} style={inputStyle} />
              </Field>
            </div>

            <Field label="Color">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {JOB_COLORS.map(c => (
                  <div key={c} onClick={() => setModal(m => ({ ...m, job: { ...m.job, color: c } }))}
                    style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: "pointer",
                      border: modal.job.color === c ? "3px solid #1E293B" : "3px solid transparent",
                      boxSizing: "border-box" }} />
                ))}
              </div>
            </Field>

            <Field label="Notes (optional)">
              <input value={modal.job.notes || ""} onChange={e => setModal(m => ({ ...m, job: { ...m.job, notes: e.target.value } }))} style={inputStyle} />
            </Field>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={btnStyle("#E2E8F0", "#334155")}>Cancel</button>
              <button onClick={confirmModal} style={btnStyle(modal.job.color || "#6366F1")}>
                {modal.mode === "add" ? "Add Job" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#1E293B", color: "#fff", padding: "10px 20px",
          borderRadius: 8, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 100,
          animation: "fadeIn 0.2s",
        }}>{toast}</div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function btnStyle(bg, color = "#fff") {
  return {
    background: bg, color, border: "none", borderRadius: 7,
    padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

const inputStyle = {
  width: "100%", border: "1px solid #E2E8F0", borderRadius: 7,
  padding: "8px 10px", fontSize: 13, outline: "none", boxSizing: "border-box",
  color: "#1E293B", background: "#F8F9FB",
};

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
