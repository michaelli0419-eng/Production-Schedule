-- ═══════════════════════════════════════════════════════════════
-- Migration v3 — Add pm column to jobs
-- Paste into Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pm TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_pm ON jobs (pm);

NOTIFY pgrst, 'reload schema';
