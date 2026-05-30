/**
 * import-crm.mjs
 * Reads SCM_Master_CRM.xlsx → writes parsed-deals.json
 *
 * Run: node scripts/import-crm.mjs
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";
const require = createRequire(import.meta.url);
const ExcelJS = require("../excel-server/node_modules/exceljs/dist/es5/exceljs.nodejs.js");

const EXCEL_PATH = "C:\\Users\\Michael Li\\Downloads\\SCM_Master_CRM.xlsx";
const SHEET_NAME = "Master Jobs";

// ── Stage from confidence level (0–1 float or 0–100 int) ────────────────────
function stageFromConfidence(raw) {
  if (raw == null || raw === "" || raw === "null") return null;
  let v = parseFloat(String(raw).replace(/[%,]/g, "").trim());
  if (isNaN(v)) return null;
  if (v > 1) v = v / 100; // handle "75" vs "0.75"
  if (v >= 0.9) return "handoff";
  if (v >= 0.65) return "award";
  if (v >= 0.4)  return "proposal";
  if (v >= 0.15) return "estimate";
  return "lead";
}

// ── Top-level pipeline stage label → DB stage ───────────────────────────────
function mapTopStage(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s.startsWith("lost"))   return null; // skip lost
  if (s.startsWith("closed")) return null; // skip closed historical
  if (s === "lead / pre-con") return "lead";
  if (s === "lead")           return "lead";
  if (s.includes("pipeline")) return "USE_CONFIDENCE"; // Active Pipeline 2026
  if (s === "shipped")        return "handoff";
  if (s === "in production")  return "handoff";
  if (s === "production")     return "handoff";
  return "USE_CONFIDENCE"; // anything else, fall back to confidence
}

const STAGE_PROB = { lead: 15, estimate: 35, proposal: 55, award: 80, handoff: 95 };

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val)) return null;
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s || s === "null") return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return null;
}

function toNum(val) {
  if (val == null || val === "") return 0;
  const n = parseFloat(String(val).replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function str(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" || s === "null" ? null : s;
}

async function main() {
  console.log("Reading Excel…");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`);

  const deals = [];
  const skipped = [];
  const stageCounts = {};

  ws.eachRow((row, rowNum) => {
    if (rowNum <= 2) return; // skip title banner (row 1) and header (row 2)

    const c = row.values; // 1-indexed array
    // Column layout (1-based):
    // [1] Job #          [2] Project Name    [3] Customer/District
    // [4] BDM            [5] PM              [6] Pipeline Stage
    // [7] Production Stage [8] Prod Line     [9] Contract Value
    // [10] Estimated Value [11] Contract Type [12] Bid/Piggyback
    // [13] Confidence Level [14] Quarter      [15] Prod Start Date
    // [16] District Occupancy Date (≈close)   [17] Topset Date
    // [18] Shipping Date  [19] Set Date       [20] Eng Release Date
    // [21] Job Release    [22] Handoff Mtg    [23] Kickoff Mtg
    // [24] DSA Status     [25] DSA Redlines   [26] Est DSA Approval
    // [27] Inspector      [28] Lab            [29] Buildings
    // [30] Floors         [31] Job Card       [32] Factory Sub Status
    // [33] Contract Status [34] Current Status/Notes
    // [35] Open Items     [36] PM Update

    const projName = str(c[2]);
    if (!projName) return;

    const topStageRaw = str(c[6]);
    const topStage    = mapTopStage(topStageRaw);

    if (topStage === null) {
      skipped.push({ rowNum, reason: topStageRaw, name: projName });
      return;
    }

    let stage = topStage;
    if (stage === "USE_CONFIDENCE") {
      stage = stageFromConfidence(c[13]) ?? "lead";
    }

    const contractValue = toNum(c[9]);
    const estimatedValue = toNum(c[10]);
    const amount = contractValue || estimatedValue || 0;
    const prob   = STAGE_PROB[stage];

    const jobNum = str(c[1]);
    // Build a stable ID: prefer job number, else row number
    const id = jobNum
      ? `crm-${String(jobNum).replace(/\.0$/, "").replace(/\s+/g, "-")}`
      : `crm-row-${rowNum}`;

    // Combine notes fields for context
    const noteParts = [str(c[33]), str(c[34]), str(c[35])].filter(Boolean);
    const notes = noteParts.length ? noteParts.join("\n---\n") : null;

    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    deals.push({
      id,
      opportunity_name:    projName,
      client:              str(c[3]),
      stage,
      probability:         prob,
      amount,
      weighted_amount:     Math.round(amount * (prob / 100)),
      prod_start_date:     toDateStr(c[15]),
      expected_close_date: toDateStr(c[16]),
      bdm:                 str(c[4]),
      project_manager:     str(c[5]),
      building_type:       str(c[29]) || null,
      modules:             0,
      estimator:           null,
      notes,
      source_type:         "excel_import",
      source_sheet:        SHEET_NAME,
      source_row:          rowNum,
    });
  });

  console.log(`\nParsed: ${deals.length} deals`);
  console.log("By stage:", stageCounts);
  console.log(`Skipped: ${skipped.length} rows`);

  const skipReasons = {};
  for (const s of skipped) skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;
  console.log("Skip reasons:", skipReasons);

  writeFileSync("scripts/parsed-deals.json", JSON.stringify(deals, null, 2));
  console.log("\nWrote scripts/parsed-deals.json");
}

main().catch(err => { console.error(err); process.exit(1); });
