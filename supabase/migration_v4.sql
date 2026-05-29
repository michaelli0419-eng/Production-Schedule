-- ═══════════════════════════════════════════════════════════════════════════
-- SCM Hub — Migration v4
-- Expands Procore webhook integration:
--   • procore_rfis          — one row per RFI per job
--   • procore_punch_items   — one row per punch item per job
--   • procore_change_events — one row per change event per job
--   • procore_inspections   — one row per inspection/checklist per job
--   • procore_observations  — one row per observation per job
--   • jobs new columns      — denormalised live counters + contract fields
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. New columns on jobs ───────────────────────────────────────────────────

ALTER TABLE jobs
  -- Procore project linkage (set once via job notes or direct mapping)
  ADD COLUMN IF NOT EXISTS procore_project_id       INT,

  -- Live counters kept in sync by the webhook handler
  ADD COLUMN IF NOT EXISTS rfi_open_count           INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rfi_overdue_count        INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punch_open_count         INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS punch_schedule_impact_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_event_count       INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_deficient_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observation_open_count   INT DEFAULT 0,

  -- Contract / financial fields (from prime contract + work order webhooks)
  ADD COLUMN IF NOT EXISTS prime_contract_executed  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prime_contract_date      DATE,
  ADD COLUMN IF NOT EXISTS subcontract_executed     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subcontract_amount       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS subcontract_date         DATE;

CREATE INDEX IF NOT EXISTS idx_jobs_procore_project_id ON jobs (procore_project_id);

-- ─── 2. procore_rfis ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procore_rfis (
  id              TEXT PRIMARY KEY,   -- deterministic uuid from procore RFI id
  job_id          TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  procore_id      INT  NOT NULL,
  number          TEXT,
  title           TEXT,
  status          TEXT,               -- open | closed | draft | pending_owner_review
  priority        TEXT,               -- low | medium | high | critical
  question        TEXT,
  answer          TEXT,
  due_date        DATE,
  closed_at       DATE,
  ball_in_court   TEXT,               -- name of person/org who needs to respond
  spec_section    TEXT,
  assignee        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procore_rfis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_rfis_all" ON procore_rfis;
CREATE POLICY "scm_procore_rfis_all" ON procore_rfis FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_procore_rfis_job_id ON procore_rfis (job_id);
CREATE INDEX IF NOT EXISTS idx_procore_rfis_status ON procore_rfis (status);

-- ─── 3. procore_punch_items ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procore_punch_items (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  procore_id      INT  NOT NULL,
  name            TEXT,
  status          TEXT,               -- open | closed | ready_for_review
  priority        TEXT,               -- low | medium | high
  due_date        DATE,
  closed_at       DATE,
  schedule_impact TEXT,               -- yes | no | unknown
  schedule_impact_days INT DEFAULT 0,
  cost_impact     TEXT,               -- yes | no | unknown
  cost_impact_amount NUMERIC(12,2) DEFAULT 0,
  assignee        TEXT,
  trade           TEXT,
  location        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procore_punch_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_punch_items_all" ON procore_punch_items;
CREATE POLICY "scm_procore_punch_items_all" ON procore_punch_items FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_procore_punch_items_job_id ON procore_punch_items (job_id);
CREATE INDEX IF NOT EXISTS idx_procore_punch_items_status ON procore_punch_items (status);

-- ─── 4. procore_change_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procore_change_events (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  procore_id      INT  NOT NULL,
  number          TEXT,
  title           TEXT,
  status          TEXT,               -- open | closed | void
  scope           TEXT,               -- in_scope | out_of_scope | unknown
  change_type     TEXT,
  change_reason   TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procore_change_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_change_events_all" ON procore_change_events;
CREATE POLICY "scm_procore_change_events_all" ON procore_change_events FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_procore_change_events_job_id ON procore_change_events (job_id);

-- ─── 5. procore_inspections ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procore_inspections (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  procore_id      INT  NOT NULL,
  name            TEXT,
  status          TEXT,               -- open | closed | completed
  inspection_date DATE,
  due_at          DATE,
  inspector       TEXT,
  responsible_contractor TEXT,
  conforming_count    INT DEFAULT 0,
  deficient_count     INT DEFAULT 0,
  total_items         INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procore_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_inspections_all" ON procore_inspections;
CREATE POLICY "scm_procore_inspections_all" ON procore_inspections FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_procore_inspections_job_id ON procore_inspections (job_id);

-- ─── 6. procore_observations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS procore_observations (
  id              TEXT PRIMARY KEY,
  job_id          TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  procore_id      INT  NOT NULL,
  number          TEXT,
  name            TEXT,
  status          TEXT,               -- initiated | ready_to_close | closed | not_accepted
  priority        TEXT,
  due_date        DATE,
  closed_at       DATE,
  assignee        TEXT,
  trade           TEXT,
  observation_type TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE procore_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_observations_all" ON procore_observations;
CREATE POLICY "scm_procore_observations_all" ON procore_observations FOR ALL USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_procore_observations_job_id ON procore_observations (job_id);

-- ─── 7. Realtime for new tables ───────────────────────────────────────────────

DO $$
DECLARE tables TEXT[] := ARRAY[
  'procore_rfis', 'procore_punch_items', 'procore_change_events',
  'procore_inspections', 'procore_observations'
];
t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─── 8. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
