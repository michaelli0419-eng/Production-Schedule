import { supabase } from './supabase.js';
import { fetchAllPipelineDeals } from './pipelineApi.js';

export async function fetchProductionJobs({ search, line, status } = {}) {
  let query = supabase.from('jobs').select('*').order('start_date', { ascending: true });
  if (search) query = query.or(`name.ilike.%${search}%,job_number.ilike.%${search}%,client.ilike.%${search}%`);
  if (line) query = query.eq('line_id', line);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  const jobs = data ?? [];

  const deals = await fetchAllPipelineDeals();
  const convertedDealIds = new Set(jobs.map((j) => j.source_deal_id).filter(Boolean));
  const pipelineRows = deals
    .filter((deal) => !convertedDealIds.has(deal.id) && !deal.convertedJobId)
    .map((deal) => ({
      id: `pipeline:${deal.id}`,
      job_number: deal.jobNumber || null,
      name: deal.opportunityName || 'Pipeline Opportunity',
      client: deal.client || null,
      line_id: 'QUEUE',
      status: 'forecast',
      start_date: deal.prodStartDate || deal.expectedCloseDate || null,
      end_date: deal.expectedCloseDate || null,
      due_date: deal.expectedCloseDate || null,
      source_deal_id: deal.id,
      source_type: 'sales_pipeline_deals',
      notes: deal.notes || null,
    }));

  const merged = [...jobs, ...pipelineRows];
  return merged.filter((row) => {
    const matchesSearch = search
      ? `${row.name || ''} ${row.job_number || ''} ${row.client || ''}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesLine = line ? row.line_id === line : true;
    const matchesStatus = status ? row.status === status : true;
    return matchesSearch && matchesLine && matchesStatus;
  });
}

export async function fetchProductionJob(id) {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateProductionJob(id, payload) {
  const { data, error } = await supabase.from('jobs').update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function fetchJobMilestones(jobId) {
  const { data, error } = await supabase
    .from('job_milestones')
    .select('*')
    .eq('job_id', jobId)
    .order('planned_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertJobMilestone(payload) {
  const { data, error } = await supabase
    .from('job_milestones')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function fetchJobRoutingSteps(jobId) {
  const { data, error } = await supabase
    .from('job_routing_steps')
    .select('*')
    .eq('job_id', jobId)
    .order('sequence_no', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchJobMaterials(jobId) {
  const { data, error } = await supabase
    .from('job_materials')
    .select('*')
    .eq('job_id', jobId)
    .order('required_by_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
