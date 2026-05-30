-- =============================================================================
-- SCM Hub - Migration v7
-- Purpose: keep hierarchy as default while allowing controlled manual exceptions
-- =============================================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS creation_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (creation_mode IN ('workflow', 'manual', 'import')),
  ADD COLUMN IF NOT EXISTS business_context_status TEXT NOT NULL DEFAULT 'unlinked'
    CHECK (business_context_status IN ('linked', 'partial', 'unlinked')),
  ADD COLUMN IF NOT EXISTS hierarchy_exception_reason TEXT;

UPDATE jobs
SET creation_mode = CASE
    WHEN source_type IN ('crm_conversion') THEN 'workflow'
    WHEN source_type IN ('master', 'excel_import', 'sales_pipeline_deals') THEN 'import'
    ELSE 'manual'
  END
WHERE creation_mode IS NULL;

UPDATE jobs
SET business_context_status = CASE
    WHEN sales_order_id IS NOT NULL THEN 'linked'
    WHEN opportunity_id IS NOT NULL OR quote_id IS NOT NULL THEN 'partial'
    ELSE 'unlinked'
  END
WHERE business_context_status IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_require_sales_order_for_new_records'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_require_sales_order_for_new_records;
  END IF;
END $$;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_business_context_guardrail
  CHECK (
    creation_mode = 'manual'
    OR source_type IN ('master', 'excel_import', 'legacy')
    OR sales_order_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_jobs_creation_mode ON jobs(creation_mode);
CREATE INDEX IF NOT EXISTS idx_jobs_business_context_status ON jobs(business_context_status);

NOTIFY pgrst, 'reload schema';
