-- =============================================================================
-- SCM Hub - Migration v8
-- Purpose: contracts table + CRM compatibility views used by frontend modules
-- =============================================================================

CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  legacy_deal_id        TEXT REFERENCES sales_pipeline_deals(id) ON DELETE SET NULL,
  job_id                TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  contract_number       TEXT,
  contract_name         TEXT NOT NULL,
  client_name           TEXT,
  contract_value        NUMERIC(14,2) NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','pending_signature','executed','cancelled','expired')),
  signed_date           DATE,
  effective_date        DATE,
  notes                 TEXT,
  source_type           TEXT,
  source_sheet          TEXT,
  source_row            INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_opp ON contracts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_contracts_job ON contracts(job_id);
CREATE INDEX IF NOT EXISTS idx_contracts_legacy_deal ON contracts(legacy_deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_contracts_legacy_deal ON contracts(legacy_deal_id) WHERE legacy_deal_id IS NOT NULL;

DROP TRIGGER IF EXISTS contracts_upd ON contracts;
CREATE TRIGGER contracts_upd BEFORE UPDATE ON contracts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_contracts_all" ON contracts;
CREATE POLICY "scm_contracts_all" ON contracts FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Compatibility views for frontend .from("crm_*") calls.
CREATE OR REPLACE VIEW crm_companies AS
SELECT * FROM companies;

CREATE OR REPLACE VIEW crm_contacts AS
SELECT * FROM contacts;

CREATE OR REPLACE VIEW crm_leads AS
SELECT * FROM leads;

CREATE OR REPLACE VIEW crm_opportunities AS
SELECT * FROM opportunities;

-- Grants for anon/authenticated roles commonly used by Supabase clients.
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_companies TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_contacts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_leads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_opportunities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
