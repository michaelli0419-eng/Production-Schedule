import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const PORT = Number(process.env.EXCEL_SYNC_PORT || 5174);
const WORKBOOK_PATH =
  process.env.PRODUCTION_SCHEDULE_XLSX ||
  "C:\\Users\\Michael Li\\OneDrive - Webb Family Enterprises\\SCM AI\\SCM Production Schedule - Master Excel (1).xlsx";
const SHEET_NAME = process.env.PRODUCTION_SCHEDULE_SHEET || "On Line Upcoming";
const ADDITIONS_SHEET = "Website Additions";

const SIMPLE_HEADERS = [
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

const MASTER_COLUMNS = {
  jobNumber: 0,
  name: 1,
  client: 2,
  contract: 3,
  submittalsOut: 4,
  submittalsReceived: 5,
  dsaStatus: 6,
  dsaRedlines: 7,
  dsaApproval: 8,
  inspector: 9,
  jobCard: 10,
  lab: 11,
  subcontractStatus: 12,
  topset: 13,
  shipping: 14,
  set: 15,
  openItems: 16,
  pmUpdate: 17,
};

const LINE_COLORS = {
  L1: "#2563eb",
  L2: "#059669",
  L3: "#d97706",
  L4: "#dc2626",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function normalizeBool(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return value === true || value === 1 || ["true", "yes", "approved", "complete", "completed"].includes(text);
}

function excelSerialToDate(value) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return "";
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function isoDate(year, month, day) {
  if (!year || !month || !day) return "";
  const fullYear = year < 100 ? 2000 + year : year;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseScheduleDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return excelSerialToDate(value);

  const text = String(value).replace(/\u00a0/g, " ").trim();
  if (!text) return "";

  const slashDate = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slashDate) return isoDate(Number(slashDate[3]), Number(slashDate[1]), Number(slashDate[2]));

  const slashNoYear = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slashNoYear) return isoDate(2026, Number(slashNoYear[1]), Number(slashNoYear[2]));

  const monthYear = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]+(\d{2,4})\b/i);
  if (monthYear) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
      monthYear[1].slice(0, 3).toLowerCase(),
    ) + 1;
    return isoDate(Number(monthYear[2]), month, 1);
  }

  return "";
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cellValue(row, column) {
  return row[column] ?? "";
}

function inferStatus(row) {
  const joined = row.map((value) => cleanText(value).toLowerCase()).join(" ");
  if (joined.includes("need") || joined.includes("waiting") || joined.includes("shortage") || joined.includes("no eta")) {
    return "hold";
  }
  if (joined.includes("approved") || joined.includes("complete")) return "approved";
  return "production";
}

function inferModules(name) {
  const counts = [...String(name).matchAll(/\((\d+)\)/g)].map((match) => Number(match[1]));
  if (counts.length) return counts.reduce((sum, value) => sum + value, 0);
  const floors = String(name).match(/\b(\d+)\s*floors?\b/i);
  if (floors) return Number(floors[1]);
  return 1;
}

function masterRowToJob(row, rowNumber, line) {
  const topset = parseScheduleDate(cellValue(row, MASTER_COLUMNS.topset));
  const shipping = parseScheduleDate(cellValue(row, MASTER_COLUMNS.shipping));
  const set = parseScheduleDate(cellValue(row, MASTER_COLUMNS.set));
  const start = topset || shipping || set || "2026-01-01";
  const end = shipping || set || addDays(start, 14);
  const name = cleanText(cellValue(row, MASTER_COLUMNS.name)) || "Unnamed job";
  const openItems = cleanText(cellValue(row, MASTER_COLUMNS.openItems));
  const pmUpdate = cleanText(cellValue(row, MASTER_COLUMNS.pmUpdate));

  return {
    id: `master-${rowNumber}`,
    sourceType: "master",
    sourceSheet: SHEET_NAME,
    sourceRow: rowNumber,
    jobNumber: cleanText(cellValue(row, MASTER_COLUMNS.jobNumber)),
    name,
    client: cleanText(cellValue(row, MASTER_COLUMNS.client)) || "Project team",
    line,
    start,
    end,
    due: set || end,
    color: LINE_COLORS[line] || "#2563eb",
    status: inferStatus(row),
    modules: inferModules(name),
    crew: 10,
    priority: end > (set || end) ? "High" : "Medium",
    progress: normalizeBool(cellValue(row, MASTER_COLUMNS.jobCard)) ? 50 : 10,
    readiness: {
      drawings: normalizeBool(cellValue(row, MASTER_COLUMNS.submittalsReceived)),
      materials: normalizeBool(cellValue(row, MASTER_COLUMNS.subcontractStatus)),
      permits: normalizeBool(cellValue(row, MASTER_COLUMNS.dsaStatus)),
      inspections: Boolean(cleanText(cellValue(row, MASTER_COLUMNS.inspector))),
    },
    master: {
      contract: cleanText(cellValue(row, MASTER_COLUMNS.contract)),
      submittalsOut: cleanText(cellValue(row, MASTER_COLUMNS.submittalsOut)),
      submittalsReceived: cleanText(cellValue(row, MASTER_COLUMNS.submittalsReceived)),
      dsaStatus: cleanText(cellValue(row, MASTER_COLUMNS.dsaStatus)),
      dsaRedlines: cleanText(cellValue(row, MASTER_COLUMNS.dsaRedlines)),
      dsaApproval: cleanText(cellValue(row, MASTER_COLUMNS.dsaApproval)),
      inspector: cleanText(cellValue(row, MASTER_COLUMNS.inspector)),
      jobCard: cleanText(cellValue(row, MASTER_COLUMNS.jobCard)),
      lab: cleanText(cellValue(row, MASTER_COLUMNS.lab)),
      subcontractStatus: cleanText(cellValue(row, MASTER_COLUMNS.subcontractStatus)),
      openItems,
      pmUpdate,
    },
    notes: [openItems, pmUpdate].filter(Boolean).join("\n\nPM Update: "),
  };
}

function simpleRowToJob(row, index) {
  return {
    id: String(row.id || Date.now() + index),
    name: row.name || row.job_name || "New School Project",
    client: row.client || "School District",
    line: row.line || "L1",
    start: parseScheduleDate(row.start || row.start_date) || "2026-01-01",
    end: parseScheduleDate(row.end || row.end_date) || "2026-01-15",
    due: parseScheduleDate(row.due || row.due_date || row.end || row.end_date) || "2026-01-15",
    color: row.color || LINE_COLORS[row.line] || "#2563eb",
    status: row.status || "forecast",
    modules: Number(row.modules) || 1,
    crew: Number(row.crew) || 10,
    priority: row.priority || "Medium",
    progress: Number(row.progress) || 0,
    readiness: {
      drawings: normalizeBool(row.drawings_ready),
      materials: normalizeBool(row.materials_ready),
      permits: normalizeBool(row.permits_ready),
      inspections: normalizeBool(row.inspections_ready),
    },
    notes: row.notes || "",
  };
}

function jobToSimpleRow(job) {
  return {
    id: job.id,
    name: job.name,
    client: job.client,
    line: job.line,
    start: job.start,
    end: job.end,
    due: job.due,
    color: job.color,
    status: job.status,
    modules: job.modules,
    crew: job.crew,
    priority: job.priority,
    progress: job.progress,
    drawings_ready: Boolean(job.readiness?.drawings),
    materials_ready: Boolean(job.readiness?.materials),
    permits_ready: Boolean(job.readiness?.permits),
    inspections_ready: Boolean(job.readiness?.inspections),
    notes: job.notes || "",
  };
}

function isMasterWorkbook(workbook) {
  return Boolean(workbook.Sheets[SHEET_NAME] && SHEET_NAME === "On Line Upcoming");
}

function readMasterJobs(workbook) {
  const sheet = workbook.Sheets[SHEET_NAME];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const markers = [];

  rows.forEach((row, index) => {
    const lineName = cleanText(row[1]);
    const match = lineName.match(/^Line\s*(\d)$/i);
    if (match) markers.push({ rowIndex: index, line: `L${match[1]}` });
  });

  const jobs = [];
  markers.forEach((marker, index) => {
    const nextMarkerIndex = markers[index + 1]?.rowIndex ?? rows.length;
    for (let rowIndex = marker.rowIndex + 1; rowIndex < nextMarkerIndex; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!cleanText(row[MASTER_COLUMNS.jobNumber]) && !cleanText(row[MASTER_COLUMNS.name])) continue;
      jobs.push(masterRowToJob(row, rowIndex + 1, marker.line));
    }
  });

  const additions = workbook.Sheets[ADDITIONS_SHEET]
    ? XLSX.utils.sheet_to_json(workbook.Sheets[ADDITIONS_SHEET], { defval: "" }).map(simpleRowToJob)
    : [];

  return [...jobs, ...additions];
}

function readJobs() {
  if (!existsSync(WORKBOOK_PATH)) throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: true });

  if (isMasterWorkbook(workbook)) return readMasterJobs(workbook);

  const sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook does not contain any sheets");
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(simpleRowToJob);
}

function setCell(sheet, rowNumber, columnIndex, value) {
  const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
  sheet[address] = { t: "s", v: String(value ?? "") };
}

function splitNotes(notes) {
  const [openItems, pmUpdate] = String(notes || "").split(/\n\nPM Update:\s*/);
  return { openItems: openItems || "", pmUpdate: pmUpdate || "" };
}

function writeMasterJobs(workbook, jobs) {
  const sheet = workbook.Sheets[SHEET_NAME];
  let updated = 0;
  const additions = [];

  jobs.forEach((job) => {
    if (job.sourceType === "master" && Number(job.sourceRow)) {
      const rowNumber = Number(job.sourceRow);
      const { openItems, pmUpdate } = splitNotes(job.notes);
      const master = job.master || {};
      setCell(sheet, rowNumber, MASTER_COLUMNS.jobNumber, job.jobNumber || job.id.replace(/^master-/, ""));
      setCell(sheet, rowNumber, MASTER_COLUMNS.name, job.name);
      setCell(sheet, rowNumber, MASTER_COLUMNS.client, job.client);
      setCell(sheet, rowNumber, MASTER_COLUMNS.contract, master.contract);
      setCell(sheet, rowNumber, MASTER_COLUMNS.submittalsOut, master.submittalsOut);
      setCell(sheet, rowNumber, MASTER_COLUMNS.submittalsReceived, master.submittalsReceived);
      setCell(sheet, rowNumber, MASTER_COLUMNS.dsaStatus, master.dsaStatus);
      setCell(sheet, rowNumber, MASTER_COLUMNS.dsaRedlines, master.dsaRedlines);
      setCell(sheet, rowNumber, MASTER_COLUMNS.dsaApproval, master.dsaApproval);
      setCell(sheet, rowNumber, MASTER_COLUMNS.inspector, master.inspector);
      setCell(sheet, rowNumber, MASTER_COLUMNS.jobCard, master.jobCard);
      setCell(sheet, rowNumber, MASTER_COLUMNS.lab, master.lab);
      setCell(sheet, rowNumber, MASTER_COLUMNS.subcontractStatus, master.subcontractStatus);
      setCell(sheet, rowNumber, MASTER_COLUMNS.topset, job.start);
      setCell(sheet, rowNumber, MASTER_COLUMNS.shipping, job.end);
      setCell(sheet, rowNumber, MASTER_COLUMNS.set, job.due);
      setCell(sheet, rowNumber, MASTER_COLUMNS.openItems, master.openItems ?? openItems);
      setCell(sheet, rowNumber, MASTER_COLUMNS.pmUpdate, master.pmUpdate ?? pmUpdate);
      updated += 1;
    } else {
      additions.push(jobToSimpleRow(job));
    }
  });

  if (additions.length) {
    const additionsSheet = XLSX.utils.json_to_sheet(additions, { header: SIMPLE_HEADERS });
    additionsSheet["!cols"] = SIMPLE_HEADERS.map((header) => ({ wch: Math.max(12, header.length + 2) }));
    if (workbook.SheetNames.includes(ADDITIONS_SHEET)) {
      workbook.Sheets[ADDITIONS_SHEET] = additionsSheet;
    } else {
      XLSX.utils.book_append_sheet(workbook, additionsSheet, ADDITIONS_SHEET);
    }
  }

  XLSX.writeFile(workbook, WORKBOOK_PATH);
  return { updated, additions: additions.length };
}

function writeSimpleJobs(workbook, jobs) {
  const rows = jobs.map(jobToSimpleRow);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: SIMPLE_HEADERS });
  sheet["!cols"] = SIMPLE_HEADERS.map((header) => ({ wch: Math.max(12, header.length + 2) }));

  if (workbook.SheetNames.includes(SHEET_NAME)) workbook.Sheets[SHEET_NAME] = sheet;
  else XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);

  XLSX.writeFile(workbook, WORKBOOK_PATH);
  return { updated: jobs.length, additions: 0 };
}

function writeJobs(jobs) {
  const workbook = existsSync(WORKBOOK_PATH)
    ? XLSX.readFile(WORKBOOK_PATH, { cellDates: true })
    : XLSX.utils.book_new();

  return isMasterWorkbook(workbook) ? writeMasterJobs(workbook, jobs) : writeSimpleJobs(workbook, jobs);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        workbookPath: WORKBOOK_PATH,
        sheetName: SHEET_NAME,
        workbookExists: existsSync(WORKBOOK_PATH),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/jobs") {
      sendJson(res, 200, {
        jobs: readJobs(),
        workbookPath: WORKBOOK_PATH,
        sheetName: SHEET_NAME,
        syncedAt: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const body = JSON.parse(await readBody(req));
      if (!Array.isArray(body.jobs)) throw new Error("Expected body.jobs to be an array");
      const result = writeJobs(body.jobs);
      sendJson(res, 200, {
        ok: true,
        saved: body.jobs.length,
        ...result,
        workbookPath: WORKBOOK_PATH,
        syncedAt: new Date().toISOString(),
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Excel sync server running at http://127.0.0.1:${PORT}`);
  console.log(`Workbook: ${path.normalize(WORKBOOK_PATH)}`);
  console.log(`Sheet: ${SHEET_NAME}`);
});
