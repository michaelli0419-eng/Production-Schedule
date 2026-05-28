-- ═══════════════════════════════════════════════════════════════════════════
-- SCM Production Scheduler — Supabase Schema
--
-- HOW TO USE:
--   1. Create a project at https://supabase.com
--   2. Go to SQL Editor → New query
--   3. Paste this entire file and click Run
--   4. Then paste and run seed.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Production Lines ────────────────────────────────────────────────────────
-- Static reference table — one row per physical factory line.

CREATE TABLE IF NOT EXISTS production_lines (
  id          TEXT        PRIMARY KEY,        -- 'L1' | 'L2' | 'L3' | 'L4'
  name        TEXT        NOT NULL,           -- 'Line 1', 'Line 2', …
  focus       TEXT,                           -- 'Pods + classrooms', …
  sort_order  INT         DEFAULT 0,
  is_active   BOOLEAN     DEFAULT TRUE,
  color       TEXT        DEFAULT '#3b82f6',  -- hex accent color for UI
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ─── Jobs ─────────────────────────────────────────────────────────────────────
-- One row per scheduled production job / building.

CREATE TABLE IF NOT EXISTS jobs (

  -- ── Identity ──────────────────────────────────────────────────────────────
  id              TEXT        PRIMARY KEY,        -- 'row-3' (Excel source) or custom
  job_number      TEXT,                           -- SCM job # e.g. '11661'
  name            TEXT        NOT NULL,
  client          TEXT,                           -- District / PM name

  -- ── Schedule ──────────────────────────────────────────────────────────────
  line_id         TEXT        REFERENCES production_lines(id) ON DELETE SET NULL,
  start_date      DATE        NOT NULL,           -- Topset Date
  end_date        DATE        NOT NULL,           -- Shipping Date
  due_date        DATE,                           -- Set Date (site install)

  -- ── Display ───────────────────────────────────────────────────────────────
  color           TEXT        DEFAULT '#2563eb',
  status          TEXT        DEFAULT 'forecast'
                  CHECK (status IN (
                    'forecast', 'approved', 'hold',
                    'production', 'delayed', 'complete'
                  )),
  modules         INT         DEFAULT 12  CHECK (modules > 0),
  crew            INT         DEFAULT 12  CHECK (crew > 0),
  priority        TEXT        DEFAULT 'Medium'
                  CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  progress        INT         DEFAULT 0   CHECK (progress >= 0 AND progress <= 100),

  -- ── Production Readiness ──────────────────────────────────────────────────
  readiness_drawings     BOOLEAN DEFAULT FALSE,
  readiness_materials    BOOLEAN DEFAULT FALSE,
  readiness_permits      BOOLEAN DEFAULT FALSE,
  readiness_inspections  BOOLEAN DEFAULT FALSE,

  notes           TEXT,

  -- ── Excel Source Tracking ─────────────────────────────────────────────────
  -- Preserved so the Excel sync server can write back to the correct row.
  source_type     TEXT,       -- 'master' for Excel-sourced jobs, '' for manual
  source_sheet    TEXT,       -- e.g. 'On Line Upcoming'
  source_row      INT,        -- Excel row number (1-based)

  -- ── Master Excel Fields ───────────────────────────────────────────────────
  -- Mirrors the columns in the master Excel file exactly.
  master_contract              TEXT,
  master_submittals_out        TEXT,
  master_submittals_received   TEXT,
  master_dsa_status            TEXT,
  master_dsa_redlines          TEXT,
  master_dsa_approval          TEXT,
  master_inspector             TEXT,
  master_job_card              TEXT,
  master_lab                   TEXT,
  master_subcontract_status    TEXT,
  master_open_items            TEXT,
  master_pm_update             TEXT,

  -- ── Audit ─────────────────────────────────────────────────────────────────
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_pipeline_deals (
  id                   TEXT PRIMARY KEY,
  opportunity_name     TEXT NOT NULL,
  client               TEXT,
  stage                TEXT NOT NULL DEFAULT 'lead',
  probability          INT  NOT NULL DEFAULT 15 CHECK (probability >= 0 AND probability <= 100),
  amount               NUMERIC(14,2) NOT NULL DEFAULT 0,
  weighted_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  expected_close_date  DATE,
  estimator            TEXT,
  project_manager      TEXT,
  notes                TEXT,
  source_type          TEXT,
  source_sheet         TEXT,
  source_row           INT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT UNIQUE,
  full_name          TEXT,
  role               TEXT DEFAULT 'User',
  can_view_prices    BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);


-- ─── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_set_updated_at ON jobs;
CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sales_pipeline_deals_set_updated_at ON sales_pipeline_deals;
CREATE TRIGGER sales_pipeline_deals_set_updated_at
  BEFORE UPDATE ON sales_pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_line_id      ON jobs (line_id);
CREATE INDEX IF NOT EXISTS idx_jobs_start_date   ON jobs (start_date);
CREATE INDEX IF NOT EXISTS idx_jobs_end_date     ON jobs (end_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status       ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_source       ON jobs (source_type, source_row);
CREATE INDEX IF NOT EXISTS idx_jobs_job_number   ON jobs (job_number);


-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- Open access for now (all team members can read/write).
-- Tighten these policies once you add Supabase Auth / user logins.

ALTER TABLE jobs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pipeline_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before re-creating (safe to re-run)
DROP POLICY IF EXISTS "scm_jobs_all"             ON jobs;
DROP POLICY IF EXISTS "scm_production_lines_all" ON production_lines;
DROP POLICY IF EXISTS "scm_sales_pipeline_all"   ON sales_pipeline_deals;
DROP POLICY IF EXISTS "scm_user_profiles_self_select" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_self_update" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_service" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_admin_all" ON user_profiles;

CREATE POLICY "scm_jobs_all"
  ON jobs
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "scm_production_lines_all"
  ON production_lines
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "scm_sales_pipeline_all"
  ON sales_pipeline_deals
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "scm_user_profiles_self_select"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "scm_user_profiles_self_update"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "scm_user_profiles_service"
  ON user_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "scm_user_profiles_admin_all"
  ON user_profiles
  FOR ALL
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michael@webbinvestments.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'michael@webbinvestments.com');


-- ─── Enable Realtime ──────────────────────────────────────────────────────────
-- After running this schema, go to:
--   Supabase Dashboard → Database → Replication
--   Under "Source" toggle ON the "jobs" table
--
-- Or run this SQL (safe to re-run):
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sales_pipeline_deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_pipeline_deals;
  END IF;
END $$;
