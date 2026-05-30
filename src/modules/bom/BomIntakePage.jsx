import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

function toKey(value) {
  return String(value || "").trim().toLowerCase();
}

function extractRows(workbook) {
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

export default function BomIntakePage() {
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState([]);

  const analyzed = useMemo(() => {
    const counts = new Map();
    rows.forEach((row) => {
      const itemNumber = row.itemNumber || row.item || row.Item || row["Item Number"] || "";
      const key = toKey(itemNumber);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return rows.map((row, index) => {
      const itemNumber = String(row.itemNumber || row.item || row.Item || row["Item Number"] || "").trim();
      const description = String(row.description || row.Description || row.desc || "").trim();
      const quantityRaw = row.quantity || row.Qty || row.qty || row.Quantity || 0;
      const quantity = Number(quantityRaw) || 0;
      const duplicate = itemNumber ? (counts.get(toKey(itemNumber)) || 0) > 1 : false;
      const missing = !itemNumber;
      const unknown = itemNumber ? itemNumber.startsWith("UNK") : false;
      return {
        id: `${index + 1}`,
        lineNumber: index + 1,
        itemNumber,
        description,
        quantity,
        flags: [
          missing ? "missing" : null,
          duplicate ? "duplicate" : null,
          unknown ? "unmapped" : null,
        ].filter(Boolean),
      };
    });
  }, [rows]);

  const summary = useMemo(() => {
    const stats = { total: analyzed.length, missing: 0, duplicate: 0, unmapped: 0 };
    analyzed.forEach((line) => {
      if (line.flags.includes("missing")) stats.missing += 1;
      if (line.flags.includes("duplicate")) stats.duplicate += 1;
      if (line.flags.includes("unmapped")) stats.unmapped += 1;
    });
    return stats;
  }, [analyzed]);

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    setRows(extractRows(workbook));
    event.target.value = "";
  }

  return (
    <section className="ps-panel" style={{ padding: 16 }}>
      <h2>BOM Intake</h2>
      <p>Estimating remains in Excel. This intake parses lines, versions by quote revision, and flags mapping risks.</p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <input type="file" accept=".xlsx,.xls" onChange={onUpload} />
        {filename && <span>Source file: {filename}</span>}
      </div>

      <section className="ps-kpis" style={{ marginBottom: 12 }}>
        <article className="ps-kpi"><span>Total Lines</span><strong>{summary.total}</strong><small>Parsed BOM lines</small></article>
        <article className="ps-kpi ps-kpi-amber"><span>Missing Item #</span><strong>{summary.missing}</strong><small>Needs manual mapping</small></article>
        <article className="ps-kpi ps-kpi-amber"><span>Duplicate Items</span><strong>{summary.duplicate}</strong><small>Review consolidation</small></article>
        <article className="ps-kpi"><span>Unmapped</span><strong>{summary.unmapped}</strong><small>NetSuite item validation placeholder</small></article>
      </section>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Line</th>
              <th style={{ textAlign: "left", padding: 8 }}>Item Number</th>
              <th style={{ textAlign: "left", padding: 8 }}>Description</th>
              <th style={{ textAlign: "right", padding: 8 }}>Qty</th>
              <th style={{ textAlign: "left", padding: 8 }}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {analyzed.slice(0, 100).map((line) => (
              <tr key={line.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: 8 }}>{line.lineNumber}</td>
                <td style={{ padding: 8 }}>{line.itemNumber || "-"}</td>
                <td style={{ padding: 8 }}>{line.description || "-"}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{line.quantity}</td>
                <td style={{ padding: 8 }}>{line.flags.length ? line.flags.join(", ") : "ok"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
