import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const PORT = Number(process.env.EXCEL_SYNC_PORT || 5174);
const WORKBOOK_PATH =
  process.env.PRODUCTION_SCHEDULE_XLSX ||
  "C:\\Users\\Michael Li\\OneDrive - Webb Family Enterprises\\SCM AI\\production_schedule.xlsx";
const SHEET_NAME = process.env.PRODUCTION_SCHEDULE_SHEET || "production_schedule";

const HEADERS = [
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
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

function normalizeJob(row, index) {
  return {
    id: String(row.id || Date.now() + index),
    name: row.name || row.job_name || "New School Project",
    client: row.client || "School District",
    line: row.line || "L1",
    start: normalizeDate(row.start || row.start_date),
    end: normalizeDate(row.end || row.end_date),
    due: normalizeDate(row.due || row.due_date || row.end || row.end_date),
    color: row.color || "#2563eb",
    status: row.status || "forecast",
    modules: Number(row.modules) || 0,
    crew: Number(row.crew) || 0,
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

function jobToRow(job) {
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

function readJobs() {
  if (!existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook not found: ${WORKBOOK_PATH}`);
  }

  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Workbook does not contain any sheets");

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(normalizeJob);
}

function writeJobs(jobs) {
  const workbook = existsSync(WORKBOOK_PATH)
    ? XLSX.readFile(WORKBOOK_PATH, { cellDates: true })
    : XLSX.utils.book_new();
  const rows = jobs.map(jobToRow);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  sheet["!cols"] = HEADERS.map((header) => ({ wch: Math.max(12, header.length + 2) }));

  if (workbook.SheetNames.includes(SHEET_NAME)) {
    workbook.Sheets[SHEET_NAME] = sheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  }

  XLSX.writeFile(workbook, WORKBOOK_PATH);
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
      writeJobs(body.jobs);
      sendJson(res, 200, {
        ok: true,
        saved: body.jobs.length,
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
