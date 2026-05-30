import { readFileSync, writeFileSync } from "fs";

const deals = JSON.parse(readFileSync("scripts/parsed-deals.json", "utf8"));

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  // escape single quotes
  return `'${String(v).replace(/'/g, "''")}'`;
}

const BATCH = 50;
const batches = [];
for (let i = 0; i < deals.length; i += BATCH) {
  const chunk = deals.slice(i, i + BATCH);
  const rows = chunk.map(d =>
    `(${esc(d.id)},${esc(d.opportunity_name)},${esc(d.client)},${esc(d.stage)},` +
    `${d.probability},${d.amount},${d.weighted_amount},${esc(d.expected_close_date)},` +
    `${esc(d.bdm)},${esc(d.estimator)},${esc(d.project_manager)},${esc(d.building_type)},` +
    `${d.modules},${esc(d.notes)},${esc(d.source_type)},${esc(d.source_sheet)},${d.source_row})`
  );
  const sql =
    `INSERT INTO sales_pipeline_deals ` +
    `(id,opportunity_name,client,stage,probability,amount,weighted_amount,expected_close_date,` +
    `bdm,estimator,project_manager,building_type,modules,notes,source_type,source_sheet,source_row) VALUES\n` +
    rows.join(",\n") +
    `\nON CONFLICT (id) DO UPDATE SET ` +
    `opportunity_name=EXCLUDED.opportunity_name,client=EXCLUDED.client,stage=EXCLUDED.stage,` +
    `probability=EXCLUDED.probability,amount=EXCLUDED.amount,weighted_amount=EXCLUDED.weighted_amount,` +
    `expected_close_date=EXCLUDED.expected_close_date,bdm=EXCLUDED.bdm,estimator=EXCLUDED.estimator,` +
    `project_manager=EXCLUDED.project_manager,building_type=EXCLUDED.building_type,modules=EXCLUDED.modules,` +
    `notes=EXCLUDED.notes,source_type=EXCLUDED.source_type,source_row=EXCLUDED.source_row;`;
  batches.push(sql);
}

writeFileSync("scripts/import-batches.json", JSON.stringify(batches));
console.log(`Generated ${batches.length} batches of up to ${BATCH} rows each`);
