-- One-time / repeatable sync:
-- Keeps CRM opportunities aligned with sales_pipeline_deals.
-- Safe to run multiple times.

-- 1) Update existing opportunity rows already linked to a legacy deal.
UPDATE opportunities o
SET
  name = COALESCE(d.opportunity_name, o.name),
  stage = CASE d.stage
    WHEN 'lead' THEN 'lead'
    WHEN 'estimate' THEN 'estimate'
    WHEN 'proposal' THEN 'proposal'
    WHEN 'award' THEN 'award'
    WHEN 'handoff' THEN 'handoff'
    ELSE o.stage
  END,
  probability = COALESCE(d.probability::smallint, o.probability),
  contract_value = COALESCE(d.amount, o.contract_value),
  building_type = COALESCE(d.building_type, o.building_type),
  module_count = COALESCE(d.modules, o.module_count),
  bid_due_date = COALESCE(d.expected_close_date, o.bid_due_date),
  expected_occupancy_date = COALESCE(d.expected_close_date, o.expected_occupancy_date),
  bdm_name = COALESCE(d.bdm, o.bdm_name),
  estimator_name = COALESCE(d.estimator, o.estimator_name),
  pm_name = COALESCE(d.project_manager, o.pm_name),
  source_type = COALESCE(d.source_type, o.source_type),
  source_sheet = COALESCE(d.source_sheet, o.source_sheet),
  source_row = COALESCE(d.source_row, o.source_row),
  converted_job_id = COALESCE(d.converted_job_id_fk, o.converted_job_id),
  converted_at = COALESCE(d.converted_at, o.converted_at),
  notes = COALESCE(d.notes, o.notes),
  updated_at = NOW()
FROM sales_pipeline_deals d
WHERE o.legacy_deal_id = d.id;

-- 2) Insert missing opportunities for deals that have no CRM opportunity yet.
INSERT INTO opportunities (
  legacy_deal_id,
  name,
  stage,
  probability,
  contract_value,
  building_type,
  module_count,
  bid_due_date,
  expected_occupancy_date,
  bdm_name,
  estimator_name,
  pm_name,
  source_type,
  source_sheet,
  source_row,
  converted_job_id,
  converted_at,
  notes,
  is_active,
  created_at,
  updated_at
)
SELECT
  d.id,
  d.opportunity_name,
  CASE d.stage
    WHEN 'lead' THEN 'lead'
    WHEN 'estimate' THEN 'estimate'
    WHEN 'proposal' THEN 'proposal'
    WHEN 'award' THEN 'award'
    WHEN 'handoff' THEN 'handoff'
    ELSE 'lead'
  END,
  d.probability::smallint,
  d.amount,
  d.building_type,
  d.modules,
  d.expected_close_date,
  d.expected_close_date,
  d.bdm,
  d.estimator,
  d.project_manager,
  d.source_type,
  d.source_sheet,
  d.source_row,
  d.converted_job_id_fk,
  d.converted_at,
  d.notes,
  TRUE,
  d.created_at,
  NOW()
FROM sales_pipeline_deals d
WHERE NOT EXISTS (
  SELECT 1
  FROM opportunities o
  WHERE o.legacy_deal_id = d.id
);

