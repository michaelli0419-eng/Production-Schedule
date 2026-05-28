-- SCM Scheduler: Safe Supabase setup script (idempotent)
-- Paste this whole file in Supabase SQL Editor and run.

CREATE TABLE IF NOT EXISTS user_profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT UNIQUE,
  full_name          TEXT,
  role               TEXT DEFAULT 'User',
  can_view_prices    BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE IF EXISTS jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales_pipeline_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scm_user_profiles_self_select" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_self_update" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_service" ON user_profiles;
DROP POLICY IF EXISTS "scm_user_profiles_admin_all" ON user_profiles;

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

DO $$
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;

  IF to_regclass('public.sales_pipeline_deals') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sales_pipeline_deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_pipeline_deals;
  END IF;
END $$;
