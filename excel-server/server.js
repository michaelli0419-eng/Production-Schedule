/**
 * SCM Excel Sync Server
 * Runs at http://localhost:5174
 *
 * GET  /api/jobs  → reads "On Line Upcoming" sheet, returns jobs as JSON
 * POST /api/jobs  → writes scheduler changes back to the exact Excel rows
 *
 * Setup:
 *   1. Copy .env.example → .env and set EXCEL_PATH
 *   2. cd excel-server && npm install && npm start
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = 5174;
const SHEET_NAME = "On Line Upcoming";

// ─── Column positions (1-indexed, matching the Excel file exactly) ──────────
const COL = {
  jobNumber:            1,   // A  Job Number
  jobName:              2,   // B  Job Name
  pm:                   3,   // C  Project Manager
  contract:             4,   // D  Contract
  submittalsOut:        5,   // E  Submittals Out
  submittalsReceived:   6,   // F  Submittals Received
  dsaStatus:            7,   // G  DSA Status
  dsaRedlines:          8,   // H  DSA Redlines
  dsaApproval:          9,   // I  Est. DSA Approval Date
  inspector:           10,   // J  Inspector
  jobCard:             11,   // K  Job Card
  lab:                 12,   // L  Lab
  subcontractStatus:   13,   // M  Factory Subcontract Status
  topsetDate:          14,   // N  Topset Date  → job.start
  shippingDate:        15,   // O  Shipping Date → job.end
  setDate:             16,   // P  Set Date      → job.due
  openItems:           17,   // Q  Open Items
  pmUpdate:            18,   // R  PM Update (PM notes only)
};

const JOB_COLORS = [
  "#2563eb","#059669","#d97706","#dc2626",
  "#7c3aed","#db2777","#0891b2","#65a30d",
  "#ea580c","#4f46e5","#0f766e","#be123c",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve Excel path: env var first, then look relative to this file */
function getExcelPath() {
  if (process.env.EXCEL_PATH) return path.resolve(process.env.EXCEL_PATH);
  return null;
}

function tempExcelPath(excelPath) {
  const parsed = path.parse(excelPath);
  return path.join(parsed.dir, `${parsed.name}.saving-${Date.now()}${parsed.ext}`);
}

function backupExcelPath(excelPath) {
  const parsed = path.parse(excelPath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(parsed.dir, `${parsed.name}.backup-${stamp}${parsed.ext}`);
}

function sanitizeExcelText(value, maxLength = 32000) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, maxLength);
}

function parseIsoDate(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function setTextCell(row, col, value, maxLength) {
  row.getCell(col).value = sanitizeExcelText(value, maxLength);
}

function setDateCell(row, col, value) {
  const date = parseIsoDate(value);
  if (date) row.getCell(col).value = date;
}

async function writeWorkbookSafely(workbook, excelPath) {
  const tempPath = tempExcelPath(excelPath);
  const backupPath = backupExcelPath(excelPath);

  try {
    await workbook.xlsx.writeFile(tempPath);

    const validationWorkbook = new ExcelJS.Workbook();
    await validationWorkbook.xlsx.readFile(tempPath);

    fs.copyFileSync(excelPath, backupPath);
    fs.copyFileSync(tempPath, excelPath);
    fs.unlinkSync(tempPath);
    return backupPath;
  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw err;
  }
}

/**
 * Parse an Excel cell value into an ISO date string (YYYY-MM-DD).
 * Returns null when the value is missing or a non-date text string.
 */
function parseDate(val) {
  if (!val) return null;

  // Native JS Date from exceljs date cells
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  // Excel serial number (rare when data_only)
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;

    // Reject obvious non-date text
    const skipPatterns = /tbd|update|per |need|hold|n\/a|greg|confirm|aor|district/i;
    if (skipPatterns.test(s)) return null;

    // Try parsing "MM/DD/YYYY" and ISO formats directly
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

    // Try extracting a date from messy strings like "(A1,2,3)\n4/18/2026\n(7/18/26) TBD"
    const dateMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      const [, m, d2, y] = dateMatch;
      const year = y.length === 2 ? `20${y}` : y;
      const candidate = new Date(`${year}-${m.padStart(2,"0")}-${d2.padStart(2,"0")}`);
      if (!isNaN(candidate.getTime())) return candidate.toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Derive a production status from start/end dates relative to today.
 */
function inferStatus(start, end) {
  const today = new Date().toISOString().slice(0, 10);
  if (!start) return "forecast";
  if (start > today) return "approved";
  if (end && end < today) return "complete";
  return "production"; // topset in the past, ship in the future → on the line
}

/**
 * Attempt to extract floor/module count from job name patterns like
 * "(7) 36x40", "(2) 24x40", "(58 floors)".
 */
function extractModules(name) {
  if (!name) return 12;
  const m = name.match(/\((\d+)\)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 12;
}

/**
 * Extract district/client from the first meaningful segment of a job name.
 * Job names often look like: "Pasadena USD\nFranklin ES\n(1) 96x40 Admin"
 */
function extractClient(name) {
  if (!name) return "School District";
  const firstLine = name.split(/\n/)[0].trim();
  // Take words up to the school/building description
  const words = firstLine.split(/\s+/).filter(Boolean);
  // 2-4 words usually covers the district: "Pasadena USD", "Corning Union ESD"
  return words.slice(0, Math.min(4, words.length)).join(" ") || "School District";
}

/**
 * Collapse multi-line job names to a single clean string.
 */
function cleanName(val) {
  return String(val || "").replace(/\n+/g, " – ").replace(/\s{2,}/g, " ").trim() || "Unknown Project";
}

/**
 * Safe string extraction from a cell (trims whitespace, collapses newlines).
 */
function cellStr(row, col) {
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return "";
  return String(v).replace(/\n+/g, " ").trim();
}

// ─── GET /api/jobs ────────────────────────────────────────────────────────────
app.get("/api/jobs", async (req, res) => {
  const excelPath = getExcelPath();

  if (!excelPath) {
    return res.status(500).json({
      error: "EXCEL_PATH not set. Create excel-server/.env and set EXCEL_PATH=<full path to Excel file>.",
    });
  }
  if (!fs.existsSync(excelPath)) {
    return res.status(404).json({ error: `Excel file not found: ${excelPath}` });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const ws = workbook.getWorksheet(SHEET_NAME);

    if (!ws) {
      return res.status(404).json({
        error: `Sheet "${SHEET_NAME}" not found. Available sheets: ${workbook.worksheets.map(s => s.name).join(", ")}`,
      });
    }

    const jobs = [];
    let currentLine = "L1";
    let colorIdx = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header row

      const jobNumRaw = row.getCell(COL.jobNumber).value;
      const jobNumStr = String(jobNumRaw ?? "").trim();
      const jobNameRaw = row.getCell(COL.jobName).value;
      const jobNameStr = String(jobNameRaw ?? "").trim();

      // ── Detect "Line X" section separator rows ──────────────────────────
      // Pattern: col A is blank/null, col B is "Line 1" / "Line 2" / etc.
      const isLineSep = (
        (!jobNumStr || jobNumStr === "") &&
        /^Line\s+[1-4]$/i.test(jobNameStr)
      );
      if (isLineSep) {
        const match = jobNameStr.match(/[1-4]/);
        if (match) currentLine = `L${match[0]}`;
        return;
      }

      // ── Skip legend rows (Gold / Orange / Red / Blue) ───────────────────
      if (["Gold","Orange","Red","Blue"].includes(jobNumStr)) return;

      // ── Skip rows with no job number at all ─────────────────────────────
      if (!jobNumStr) return;

      // ── Parse dates ──────────────────────────────────────────────────────
      const start = parseDate(row.getCell(COL.topsetDate).value);
      if (!start) return; // skip rows with no Topset Date — not a real job

      let end = parseDate(row.getCell(COL.shippingDate).value);
      if (!end) {
        // Default: Topset + 30 days for display purposes
        const d = new Date(start);
        d.setDate(d.getDate() + 30);
        end = d.toISOString().slice(0, 10);
      }

      const due = parseDate(row.getCell(COL.setDate).value) ?? end;

      // ── Master fields ────────────────────────────────────────────────────
      const submittalsOut      = cellStr(row, COL.submittalsOut);
      const submittalsReceived = cellStr(row, COL.submittalsReceived);
      const dsaStatus          = cellStr(row, COL.dsaStatus);
      const dsaRedlines        = cellStr(row, COL.dsaRedlines);
      const dsaApproval        = cellStr(row, COL.dsaApproval);
      const inspector          = cellStr(row, COL.inspector);
      const jobCard            = cellStr(row, COL.jobCard);
      const lab                = cellStr(row, COL.lab);
      const subcontractStatus  = cellStr(row, COL.subcontractStatus);
      const openItems          = cellStr(row, COL.openItems).slice(0, 800);
      const pmUpdate           = cellStr(row, COL.pmUpdate).slice(0, 400);
      const pm                 = cellStr(row, COL.pm);
      const contract           = cellStr(row, COL.contract);

      // ── Readiness inference ──────────────────────────────────────────────
      const readiness = {
        drawings:    submittalsOut.length > 3,
        materials:   submittalsReceived.length > 3,
        permits:     /approv/i.test(dsaStatus),
        inspections: inspector.length > 0,
      };

      // ── Build job object ─────────────────────────────────────────────────
      // Use "rowNumber" as the stable unique ID — guarantees uniqueness
      // even when the same job number spans multiple rows (multi-building jobs).
      const job = {
        id:           `row-${rowNumber}`,
        jobNumber:    jobNumStr,
        name:         cleanName(jobNameStr),
        client:       pm || extractClient(jobNameStr),
        line:         currentLine,
        start,
        end,
        due,
        color:        JOB_COLORS[colorIdx % JOB_COLORS.length],
        status:       inferStatus(start, end),
        modules:      extractModules(jobNameStr),
        crew:         12,
        priority:     "Medium",
        progress:     0,
        readiness,
        notes:        openItems,
        sourceType:   "master",
        sourceSheet:  SHEET_NAME,
        sourceRow:    rowNumber,
        master: {
          contract,
          submittalsOut:      submittalsOut.slice(0, 400),
          submittalsReceived: submittalsReceived.slice(0, 400),
          dsaStatus,
          dsaRedlines,
          dsaApproval,
          inspector,
          jobCard,
          lab,
          subcontractStatus,
          openItems,
          pmUpdate,
        },
      };

      jobs.push(job);
      colorIdx += 1;
    });

    console.log(`[GET /api/jobs] Loaded ${jobs.length} jobs from ${path.basename(excelPath)}`);
    res.json({ jobs, syncedAt: new Date().toISOString(), count: jobs.length });

  } catch (err) {
    console.error("[GET /api/jobs] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/jobs ───────────────────────────────────────────────────────────
// Writes scheduler changes back to the exact Excel rows.
// Only updates jobs that have sourceType === "master" and a valid sourceRow.
app.post("/api/jobs", async (req, res) => {
  const excelPath = getExcelPath();

  if (!excelPath) {
    return res.status(500).json({ error: "EXCEL_PATH not set." });
  }
  if (!fs.existsSync(excelPath)) {
    return res.status(404).json({ error: `Excel file not found: ${excelPath}` });
  }

  const { jobs } = req.body;
  if (!Array.isArray(jobs)) {
    return res.status(400).json({ error: "Request body must be { jobs: [...] }" });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const ws = workbook.getWorksheet(SHEET_NAME);

    if (!ws) {
      return res.status(404).json({ error: `Sheet "${SHEET_NAME}" not found.` });
    }

    let saved = 0;

    for (const job of jobs) {
      // Only write back jobs that came from this Excel sheet
      if (job.sourceType !== "master" || !job.sourceRow) continue;

      const row = ws.getRow(job.sourceRow);

      // ── Dates (write as JS Date so exceljs serialises as Excel date) ──
      setDateCell(row, COL.topsetDate, job.start);
      setDateCell(row, COL.shippingDate, job.end);
      setDateCell(row, COL.setDate, job.due);

      // ── Master text fields ────────────────────────────────────────────
      const m = job.master ?? {};
      if (m.contract            !== undefined) setTextCell(row, COL.contract, m.contract, 800);
      if (m.submittalsOut       !== undefined) setTextCell(row, COL.submittalsOut, m.submittalsOut, 800);
      if (m.submittalsReceived  !== undefined) setTextCell(row, COL.submittalsReceived, m.submittalsReceived, 800);
      if (m.dsaStatus           !== undefined) setTextCell(row, COL.dsaStatus, m.dsaStatus, 800);
      if (m.dsaRedlines         !== undefined) setTextCell(row, COL.dsaRedlines, m.dsaRedlines, 800);
      if (m.dsaApproval         !== undefined) setTextCell(row, COL.dsaApproval, m.dsaApproval, 200);
      if (m.inspector           !== undefined) setTextCell(row, COL.inspector, m.inspector, 200);
      if (m.jobCard             !== undefined) setTextCell(row, COL.jobCard, m.jobCard, 200);
      if (m.lab                 !== undefined) setTextCell(row, COL.lab, m.lab, 200);
      if (m.subcontractStatus   !== undefined) setTextCell(row, COL.subcontractStatus, m.subcontractStatus, 1200);
      if (m.openItems           !== undefined) setTextCell(row, COL.openItems, m.openItems, 3000);
      if (m.pmUpdate            !== undefined) setTextCell(row, COL.pmUpdate, m.pmUpdate, 2000);

      row.commit();
      saved += 1;
    }

    const backupPath = await writeWorkbookSafely(workbook, excelPath);
    console.log(`[POST /api/jobs] Saved ${saved} rows to ${path.basename(excelPath)}`);
    console.log(`[POST /api/jobs] Backup created at ${backupPath}`);
    res.json({ saved, backupPath, syncedAt: new Date().toISOString() });

  } catch (err) {
    console.error("[POST /api/jobs] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/status", (req, res) => {
  const excelPath = getExcelPath();
  res.json({
    status: "ok",
    excelPath: excelPath || "NOT SET",
    excelExists: excelPath ? fs.existsSync(excelPath) : false,
    sheet: SHEET_NAME,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const excelPath = getExcelPath();
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   SCM Excel Sync Server                          ║");
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`\n  Running at : http://localhost:${PORT}`);
  console.log(`  Excel file : ${excelPath ?? "⚠️  NOT SET — add EXCEL_PATH to excel-server/.env"}`);
  console.log(`  Sheet      : ${SHEET_NAME}`);
  console.log("\n  Endpoints:");
  console.log(`    GET  http://localhost:${PORT}/api/jobs    → read jobs`);
  console.log(`    POST http://localhost:${PORT}/api/jobs    → save jobs`);
  console.log(`    GET  http://localhost:${PORT}/api/status  → health check`);

  if (excelPath && !fs.existsSync(excelPath)) {
    console.warn(`\n  ⚠️  WARNING: Excel file not found at the path above.`);
    console.warn(`     Check EXCEL_PATH in excel-server/.env\n`);
  } else {
    console.log("\n  ✓  Ready\n");
  }
});
