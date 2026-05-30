-- ═══════════════════════════════════════════════════════════════════════════
-- SCM Hub — Migration v2  (paste entire file into Supabase SQL Editor → Run)
-- Existing: production_lines, jobs, user_profiles
-- Creates:  clients, sales_pipeline_deals, contacts, submittals,
--           activity_log, documents  +  new columns on jobs
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 1. Clients ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  district      TEXT,
  region        TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 2. Sales Pipeline Deals ─────────────────────────────────────────────────
-- id is TEXT to match the string IDs the frontend already generates.

CREATE TABLE IF NOT EXISTS sales_pipeline_deals (
  id                   TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  opportunity_name     TEXT        NOT NULL,
  client               TEXT,
  client_id            UUID        REFERENCES clients(id) ON DELETE SET NULL,
  stage                TEXT        NOT NULL DEFAULT 'lead'
                         CHECK (stage IN ('lead','estimate','proposal','award','handoff')),
  probability          INT         NOT NULL DEFAULT 15
                         CHECK (probability >= 0 AND probability <= 100),
  amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  weighted_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_close_date  DATE,
  modules              INT         DEFAULT 0,
  building_type        TEXT,
  bdm                  TEXT,
  estimator            TEXT,
  project_manager      TEXT,
  notes                TEXT,
  converted_job_id     TEXT,       -- filled when deal becomes a job
  converted_at         TIMESTAMPTZ,
  source_type          TEXT,
  source_sheet         TEXT,
  source_row           INT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 3. Add new columns to existing jobs table ───────────────────────────────
-- Jobs already exists — only ADD missing columns, never recreate.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS client_id     UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_deal_id TEXT REFERENCES sales_pipeline_deals(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS off_line_date  DATE;

-- Now that jobs exists, add the FK on deals → jobs
ALTER TABLE sales_pipeline_deals
  ADD COLUMN IF NOT EXISTS converted_job_id_fk TEXT REFERENCES jobs(id) ON DELETE SET NULL;

-- Backfill converted_job_id_fk from converted_job_id (plain text column set above)
UPDATE sales_pipeline_deals
  SET converted_job_id_fk = converted_job_id
  WHERE converted_job_id IS NOT NULL
    AND converted_job_id IN (SELECT id FROM jobs);


-- ─── 4. Contacts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contacts (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID  REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  role        TEXT,    -- 'PM', 'Inspector', 'DSA Rep', 'Principal', 'Contractor'
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 5. Submittals ───────────────────────────────────────────────────────────
-- job_id is TEXT to match jobs.id

CREATE TABLE IF NOT EXISTS submittals (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              TEXT  NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type                TEXT  NOT NULL DEFAULT 'general',
  title               TEXT,
  rev_number          INT   DEFAULT 1,
  status              TEXT  DEFAULT 'not_sent'
                        CHECK (status IN ('not_sent','sent','under_review','approved','rejected','resubmit_required')),
  sent_date           DATE,
  received_date       DATE,
  approved_date       DATE,
  reviewer            TEXT,
  reviewer_contact_id UUID  REFERENCES contacts(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 6. Activity Log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT  NOT NULL,   -- 'job', 'deal', 'submittal', 'client'
  entity_id    TEXT  NOT NULL,   -- TEXT covers both UUID and text IDs
  user_id      UUID  REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name    TEXT,
  action       TEXT  NOT NULL,
  detail       JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 7. Documents ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT  NOT NULL,
  entity_id     TEXT  NOT NULL,
  name          TEXT  NOT NULL,
  storage_path  TEXT,
  file_type     TEXT,
  file_size_kb  INT,
  uploaded_by   UUID  REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 8. Auto-update updated_at ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','sales_pipeline_deals','contacts','submittals','user_profiles'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t||'_upd', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t||'_upd', t);
  END LOOP;
END $$;


-- ─── 9. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_client_id    ON jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_deal_id      ON jobs (source_deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_client_id   ON sales_pipeline_deals (client_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage       ON sales_pipeline_deals (stage);
CREATE INDEX IF NOT EXISTS idx_submittals_job    ON submittals (job_id);
CREATE INDEX IF NOT EXISTS idx_submittals_status ON submittals (status);
CREATE INDEX IF NOT EXISTS idx_contacts_client   ON contacts (client_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity   ON activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_time     ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_entity  ON documents (entity_type, entity_id);


-- ─── 10. Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pipeline_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients','sales_pipeline_deals','contacts','submittals','activity_log','documents'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "scm_all" ON %I', t);
    EXECUTE format('
      CREATE POLICY "scm_all" ON %I
        FOR ALL TO authenticated
        USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;


-- ─── 11. Realtime ─────────────────────────────────────────────────────────────

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales_pipeline_deals','submittals','activity_log'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;


-- ─── 12. Reload PostgREST schema cache ───────────────────────────────────────

NOTIFY pgrst, 'reload schema';


-- ═══════════════════════════════════════════════════════════════════════════
-- SUCCESS. New tables: clients, sales_pipeline_deals, contacts,
--          submittals, activity_log, documents
-- New columns on jobs: client_id, source_deal_id, off_line_date
-- ═══════════════════════════════════════════════════════════════════════════
