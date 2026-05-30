import { supabase } from "./supabase.js";
import { fetchAllPipelineDeals } from "./pipelineApi.js";

function mapClientToCompanyRow(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    short_name: null,
    type: "other",
    industry: null,
    website: null,
    phone: row.contact_phone ?? null,
    is_active: true,
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source_type: "clients_fallback",
    district: row.district ?? null,
    region: row.region ?? null,
  };
}

function mapOpportunityRow(row) {
  return {
    ...row,
    opp_number: row.opportunity_number || null,
    opportunity_name: row.name || row.opportunity_name || "",
    company_name: row.company?.name || row.company_name || null,
    stage: row.stage || "lead",
    contract_value: row.contract_value ?? row.value ?? 0,
    probability: row.probability ?? 0,
    expected_occupancy_date: row.expected_occupancy_date || null,
  };
}

function mapDealToOpportunityView(deal) {
  const syntheticId = `deal:${deal.id}`;
  const stageMap = {
    lead: "lead",
    estimate: "estimate",
    proposal: "proposal",
    award: "award",
    handoff: "handoff",
  };
  return {
    id: syntheticId,
    legacy_deal_id: deal.id,
    opportunity_number: null,
    opp_number: null,
    name: deal.opportunityName || "Untitled Opportunity",
    opportunity_name: deal.opportunityName || "Untitled Opportunity",
    company_name: deal.client || null,
    company: deal.client ? { name: deal.client } : null,
    stage: stageMap[deal.stage] || "lead",
    probability: Number(deal.probability) || 0,
    contract_value: Number(deal.amount) || 0,
    weighted_value: Number(deal.weightedAmount) || 0,
    expected_occupancy_date: deal.expectedCloseDate || null,
    bdm_name: deal.bdm || null,
    estimator_name: deal.estimator || null,
    pm_name: deal.projectManager || null,
    converted_job_id: deal.convertedJobId || null,
    notes: deal.notes || null,
    source_type: "sales_pipeline_deals",
  };
}

async function fetchMergedOpportunityRows() {
  const [oppResult, deals] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*, company:companies(id, name)")
      .order("created_at", { ascending: false }),
    fetchAllPipelineDeals(),
  ]);

  if (oppResult.error) throw oppResult.error;
  const opps = (oppResult.data || []).map(mapOpportunityRow);
  const existingLegacyDealIds = new Set(opps.map((o) => o.legacy_deal_id).filter(Boolean));
  const virtualOpps = deals
    .filter((d) => !existingLegacyDealIds.has(d.id))
    .map(mapDealToOpportunityView);

  return [...opps, ...virtualOpps];
}

// ── COMPANIES ──────────────────────────────────────────────────────────────

export async function fetchCompanies({ search, type, isActive, page = 1, pageSize = 25 } = {}) {
  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .order("name");

  if (search) query = query.ilike("name", `%${search}%`);
  if (type) query = query.eq("type", type);
  if (isActive !== undefined && isActive !== null) query = query.eq("is_active", isActive);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (!error && (count ?? 0) > 0) return { data, count };
  if (!error && (count ?? 0) === 0) {
    let clientsQuery = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .order("name");
    if (search) clientsQuery = clientsQuery.ilike("name", `%${search}%`);
    const fallbackFrom = (page - 1) * pageSize;
    clientsQuery = clientsQuery.range(fallbackFrom, fallbackFrom + pageSize - 1);
    const { data: clientsData, error: clientsError, count: clientsCount } = await clientsQuery;
    if (clientsError) throw clientsError;
    return { data: (clientsData ?? []).map(mapClientToCompanyRow), count: clientsCount };
  }

  const fallbackCodes = new Set(["PGRST205", "42P01"]);
  if (!fallbackCodes.has(error.code)) throw error;

  let clientsQuery = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("name");
  if (search) clientsQuery = clientsQuery.ilike("name", `%${search}%`);
  const fallbackFrom = (page - 1) * pageSize;
  clientsQuery = clientsQuery.range(fallbackFrom, fallbackFrom + pageSize - 1);
  const { data: clientsData, error: clientsError, count: clientsCount } = await clientsQuery;
  if (clientsError) throw clientsError;
  return { data: (clientsData ?? []).map(mapClientToCompanyRow), count: clientsCount };
}

export async function fetchCompany(id) {
  const { data, error } = await supabase
    .from("companies")
    .select("*, contacts:contacts(*)")
    .eq("id", id)
    .single();
  if (!error) return data;

  const fallbackCodes = new Set(["PGRST205", "42P01", "PGRST116"]);
  if (!fallbackCodes.has(error.code)) throw error;
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (clientError) throw clientError;
  return { ...mapClientToCompanyRow(clientRow), contacts: [] };
}

export async function createCompany(data) {
  const { data: result, error } = await supabase
    .from("companies")
    .insert(data)
    .select()
    .single();
  if (!error) return result;

  const fallbackCodes = new Set(["PGRST205", "42P01", "42501"]);
  if (!fallbackCodes.has(error.code)) throw error;
  const payload = {
    name: data.name,
    district: data.district ?? null,
    region: data.region ?? null,
    contact_phone: data.phone ?? null,
    notes: data.notes ?? null,
  };
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .insert(payload)
    .select()
    .single();
  if (clientError) throw clientError;
  return mapClientToCompanyRow(clientRow);
}

export async function updateCompany(id, data) {
  const { data: result, error } = await supabase
    .from("companies")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (!error) return result;

  const fallbackCodes = new Set(["PGRST205", "42P01", "42501"]);
  if (!fallbackCodes.has(error.code)) throw error;
  const payload = {
    name: data.name,
    district: data.district ?? null,
    region: data.region ?? null,
    contact_phone: data.phone ?? null,
    notes: data.notes ?? null,
  };
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (clientError) throw clientError;
  return mapClientToCompanyRow(clientRow);
}

// ── CONTACTS ───────────────────────────────────────────────────────────────

export async function fetchContacts({ search, companyId, page = 1, pageSize = 25 } = {}) {
  let query = supabase
    .from("contacts")
    .select("*, company:companies(id, name)", { count: "exact" })
    .order("last_name")
    .order("first_name");

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (companyId) query = query.eq("company_id", companyId);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function fetchContact(id) {
  const { data, error } = await supabase
    .from("contacts")
    .select("*, company:companies(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createContact(data) {
  const { data: result, error } = await supabase
    .from("contacts")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateContact(id, data) {
  const { data: result, error } = await supabase
    .from("contacts")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ── LEADS ──────────────────────────────────────────────────────────────────

export async function fetchLeads({ search, status, assignedTo, page = 1, pageSize = 25 } = {}) {
  let query = supabase
    .from("leads")
    .select(
      "*, company:companies(id, name), contact:contacts(id, first_name, last_name, email)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("title", `%${search}%`);
  if (status) query = query.eq("status", status);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function fetchLead(id) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "*, company:companies(*), contact:contacts(*), activities:crm_activities(*)"
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createLead(data) {
  const { data: result, error } = await supabase
    .from("leads")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateLead(id, data) {
  const { data: result, error } = await supabase
    .from("leads")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function convertLeadToOpportunity(leadId, oppData) {
  const { data: opportunity, error: oppError } = await supabase
    .from("opportunities")
    .insert(oppData)
    .select()
    .single();
  if (oppError) throw oppError;

  const { error: leadError } = await supabase
    .from("leads")
    .update({ status: "converted", converted_opportunity_id: opportunity.id })
    .eq("id", leadId);
  if (leadError) throw leadError;

  return opportunity;
}

// ── OPPORTUNITIES ──────────────────────────────────────────────────────────

export async function fetchOpportunities({ search, stage, bdmName, bdm, page = 1, pageSize = 25 } = {}) {
  const rows = await fetchMergedOpportunityRows();
  const bdmFilter = bdmName || bdm;
  const filtered = rows.filter((row) => {
    const s = search
      ? `${row.opportunity_name || ""} ${row.company_name || ""} ${row.bdm_name || ""}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const st = stage ? row.stage === stage : true;
    const b = bdmFilter ? row.bdm_name === bdmFilter : true;
    return s && st && b;
  });
  const from = (page - 1) * pageSize;
  const paged = filtered.slice(from, from + pageSize);
  return { data: paged, count: filtered.length };
}

export async function fetchOpportunitiesByStage() {
  const data = await fetchMergedOpportunityRows();
  return (data || []).reduce((acc, opp) => {
    const stage = opp.stage || "unknown";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(opp);
    return acc;
  }, {});
}

export async function fetchOpportunity(id) {
  if (String(id).startsWith("deal:")) {
    const dealId = String(id).slice(5);
    const deals = await fetchAllPipelineDeals();
    const found = deals.find((d) => d.id === dealId);
    return found ? mapDealToOpportunityView(found) : null;
  }

  const { data, error } = await supabase
    .from("opportunities")
    .select("*, company:companies(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return mapOpportunityRow({ ...data, company_name: data?.company?.name || null });
}

function buildOppPayload(data) {
  const payload = {
    name: data.name,
    stage: data.stage ?? 'lead',
    probability: Number(data.probability ?? 0),
    contract_value: Number(data.contract_value ?? data.value ?? 0),
  };
  if (data.company_id !== undefined)            payload.company_id = data.company_id || null;
  if (data.primary_contact_id !== undefined)    payload.primary_contact_id = data.primary_contact_id || null;
  if (data.margin_pct !== undefined)            payload.margin_pct = data.margin_pct ? Number(data.margin_pct) : null;
  if (data.building_type !== undefined)         payload.building_type = data.building_type || null;
  if (data.module_count !== undefined)          payload.module_count = data.module_count ? Number(data.module_count) : null;
  if (data.scope_summary !== undefined)         payload.scope_summary = data.scope_summary || null;
  if (data.delivery_city !== undefined)         payload.delivery_city = data.delivery_city || null;
  if (data.delivery_state !== undefined)        payload.delivery_state = data.delivery_state || null;
  if (data.bid_due_date !== undefined)          payload.bid_due_date = data.bid_due_date || null;
  if (data.expected_award_date !== undefined)   payload.expected_award_date = data.expected_award_date || null;
  if (data.expected_start_date !== undefined)   payload.expected_start_date = data.expected_start_date || null;
  if (data.expected_occupancy_date !== undefined) payload.expected_occupancy_date = data.expected_occupancy_date || null;
  if (data.bdm_name !== undefined)              payload.bdm_name = data.bdm_name || null;
  if (data.estimator_name !== undefined)        payload.estimator_name = data.estimator_name || null;
  if (data.pm_name !== undefined)               payload.pm_name = data.pm_name || null;
  if (data.notes !== undefined)                 payload.notes = data.notes || null;
  return payload;
}

export async function createOpportunity(data) {
  const { data: result, error } = await supabase
    .from("opportunities")
    .insert(buildOppPayload(data))
    .select()
    .single();
  if (error) throw error;
  return mapOpportunityRow(result);
}

export async function updateOpportunity(id, data) {
  if (String(id).startsWith("deal:")) {
    throw new Error("Pipeline-only records must be edited in the Sales Pipeline tab.");
  }
  const { data: result, error } = await supabase
    .from("opportunities")
    .update(buildOppPayload(data))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapOpportunityRow(result);
}

export async function moveOpportunityStage(id, stage, probability) {
  if (String(id).startsWith("deal:")) {
    throw new Error("Move this record from Sales Pipeline.");
  }
  const payload = { stage };
  if (probability !== undefined && probability !== null) payload.probability = probability;

  const { data, error } = await supabase
    .from("opportunities")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapOpportunityRow(data);
}

// ── ACTIVITIES ─────────────────────────────────────────────────────────────

export async function fetchActivities({ entityType, entityId, page = 1, pageSize = 50 } = {}) {
  let query = supabase
    .from("crm_activities")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function createActivity(data) {
  const { data: result, error } = await supabase
    .from("crm_activities")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateActivity(id, data) {
  const { data: result, error } = await supabase
    .from("crm_activities")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ── CRM TASKS ──────────────────────────────────────────────────────────────

export async function fetchTasks({ entityType, entityId, status, assignedTo } = {}) {
  let query = supabase
    .from("crm_tasks")
    .select("*")
    .order("due_date", { ascending: true });

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (status) query = query.eq("status", status);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);

  const { data, error } = await query;
  if (error) throw error;
  return { data };
}

export async function createTask(data) {
  const { data: result, error } = await supabase
    .from("crm_tasks")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateTask(id, data) {
  const { data: result, error } = await supabase
    .from("crm_tasks")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────

function getDateYear(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getFullYear();
}

export async function fetchCrmDashboardMetrics({ year = "all" } = {}) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  const [opps, activitiesResult, tasksResult, closedResult] = await Promise.all([
    fetchMergedOpportunityRows(),

    supabase
      .from("crm_activities")
      .select("id")
      .gte("created_at", weekAgoIso),

    supabase
      .from("crm_tasks")
      .select("id")
      .eq("status", "open"),

    supabase
      .from("opportunities")
      .select("id, stage")
      .in("stage", ["award", "lost", "dead"]),
  ]);

  if (activitiesResult.error) throw activitiesResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (closedResult.error) throw closedResult.error;

  const closed = closedResult.data || [];

  const selectedYear = year === "all" ? "all" : Number(year);
  const filteredOpps = selectedYear === "all"
    ? opps
    : opps.filter((o) => getDateYear(o.expected_occupancy_date) === selectedYear);

  const allYears = [...new Set(opps
    .map((o) => getDateYear(o.expected_occupancy_date))
    .filter((y) => Number.isInteger(y))
  )].sort((a, b) => b - a);

  const totalPipelineValue = filteredOpps.reduce((sum, o) => sum + (o.contract_value || 0), 0);
  const weightedValue = filteredOpps.reduce(
    (sum, o) => sum + (o.contract_value || 0) * ((o.probability || 0) / 100),
    0
  );

  const stageMap = {};
  for (const o of filteredOpps) {
    const s = o.stage || "unknown";
    if (!stageMap[s]) stageMap[s] = { stage: s, count: 0, value: 0 };
    stageMap[s].count += 1;
    stageMap[s].value += o.contract_value || 0;
  }
  const stageBreakdown = Object.values(stageMap);

  const totalClosed = closed.length;
  const won = closed.filter((o) => o.stage === "award").length;
  const winRate = totalClosed > 0 ? Math.round((won / totalClosed) * 100) : 0;

  const bdmMap = {};
  for (const o of filteredOpps) {
    const bdm = o.bdm_name || "Unassigned";
    if (!bdmMap[bdm]) bdmMap[bdm] = { bdm_name: bdm, count: 0, value: 0 };
    bdmMap[bdm].count += 1;
    bdmMap[bdm].value += o.contract_value || 0;
  }
  const dealsByBdm = Object.values(bdmMap).sort((a, b) => b.value - a.value);

  return {
    selectedYear,
    availableYears: allYears,
    totalPipelineValue,
    weightedValue,
    stageBreakdown,
    winRate,
    activitiesThisWeek: activitiesResult.data?.length ?? 0,
    openTasks: tasksResult.data?.length ?? 0,
    dealsByBdm,
  };
}
