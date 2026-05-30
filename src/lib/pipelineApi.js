import { supabase } from "./supabase.js";

export function dbRowToPipelineDeal(row) {
  return {
    id: row.id,
    opportunityName: row.opportunity_name ?? "",
    client: row.client ?? "",
    stage: row.stage ?? "lead",
    probability: row.probability ?? 15,
    amount: row.amount ?? 0,
    weightedAmount: row.weighted_amount ?? Math.round((row.amount ?? 0) * ((row.probability ?? 0) / 100)),
    expectedCloseDate: row.expected_close_date ?? "",
    estimator: row.estimator ?? "",
    projectManager: row.project_manager ?? "",
    notes: row.notes ?? "",
    jobNumber: row.job_number ?? "",
    buildingType: row.building_type ?? "",
    confidenceLevel: row.confidence_level ?? "",
    contractType: row.contract_type ?? "",
    bidType: row.bid_type ?? "",
    sourceType: row.source_type ?? "",
    sourceSheet: row.source_sheet ?? "",
    sourceRow: row.source_row ?? null,
    clientId: row.client_id ?? null,
    bdm: row.bdm ?? "",
    modules: row.modules ?? 0,
    convertedJobId: row.converted_job_id_fk ?? null,
    convertedAt: row.converted_at ?? null,
    prodStartDate: row.prod_start_date ?? null,
  };
}

export function pipelineDealToDbRow(deal) {
  return {
    id: deal.id,
    opportunity_name: deal.opportunityName || null,
    client: deal.client || null,
    stage: deal.stage || "lead",
    probability: Number(deal.probability) || 0,
    amount: Number(deal.amount) || 0,
    weighted_amount: Number(deal.weightedAmount) || Math.round((Number(deal.amount) || 0) * ((Number(deal.probability) || 0) / 100)),
    expected_close_date: deal.expectedCloseDate || null,
    estimator: deal.estimator || null,
    project_manager: deal.projectManager || null,
    notes: deal.notes || null,
    job_number: deal.jobNumber || null,
    building_type: deal.buildingType || null,
    confidence_level: deal.confidenceLevel || null,
    contract_type: deal.contractType || null,
    bid_type: deal.bidType || null,
    source_type: deal.sourceType || null,
    source_sheet: deal.sourceSheet || null,
    source_row: deal.sourceRow || null,
    client_id: deal.clientId || null,
    bdm: deal.bdm || null,
    modules: Number(deal.modules) || 0,
    converted_job_id_fk: deal.convertedJobId || null,
    converted_at: deal.convertedAt || null,
    prod_start_date: deal.prodStartDate || null,
  };
}

export async function fetchAllPipelineDeals() {
  const { data, error } = await supabase
    .from("sales_pipeline_deals")
    .select("*")
    .order("expected_close_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`fetchAllPipelineDeals: ${error.message}`);
  return (data ?? []).map(dbRowToPipelineDeal);
}

export async function upsertPipelineDeal(deal) {
  const { error } = await supabase
    .from("sales_pipeline_deals")
    .upsert(pipelineDealToDbRow(deal), { onConflict: "id" });
  if (error) throw new Error(`upsertPipelineDeal(${deal.id}): ${error.message}`);
}

export async function upsertPipelineDeals(deals) {
  if (!deals.length) return;
  const rows = deals.map(pipelineDealToDbRow);
  const { error } = await supabase
    .from("sales_pipeline_deals")
    .upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsertPipelineDeals: ${error.message}`);
}

export async function deletePipelineDeal(id) {
  const { error } = await supabase
    .from("sales_pipeline_deals")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deletePipelineDeal(${id}): ${error.message}`);
}
