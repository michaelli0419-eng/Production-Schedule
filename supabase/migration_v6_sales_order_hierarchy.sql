-- =============================================================================
-- SCM Hub - Migration v6
-- Purpose: enforce CRM -> Quote -> Sales Order -> Production Job chain
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS sales_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_number    TEXT NOT NULL UNIQUE,
  opportunity_id        UUID NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
  quote_id              UUID REFERENCES quotes(id) ON DELETE SET NULL,
  company_id            UUID REFERENCES companies(id) ON DELETE SET NULL,
  customer_name         TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'booked', 'released_to_production', 'on_hold', 'complete', 'cancelled')),
  order_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_ship_date   DATE,
  promised_ship_date    DATE,
  total_amount          NUMERIC(14,2) DEFAULT 0,
  currency_code         TEXT DEFAULT 'USD',
  netsuite_so_id        TEXT,
  source_system         TEXT DEFAULT 'internal',
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_orders_opp ON sales_orders(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quote ON sales_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_netsuite ON sales_orders(netsuite_so_id);

DROP TRIGGER IF EXISTS sales_orders_upd ON sales_orders;
CREATE TRIGGER sales_orders_upd BEFORE UPDATE ON sales_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sales_order_number IS NULL THEN
    NEW.sales_order_number := 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(NEXTVAL('sales_order_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_order_number_gen ON sales_orders;
CREATE TRIGGER sales_order_number_gen BEFORE INSERT ON sales_orders
FOR EACH ROW EXECUTE FUNCTION generate_sales_order_number();

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_sales_orders_all" ON sales_orders;
CREATE POLICY "scm_sales_orders_all" ON sales_orders
FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_opp_id ON jobs(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_quote_id ON jobs(quote_id);
CREATE INDEX IF NOT EXISTS idx_jobs_sales_order_id ON jobs(sales_order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_require_sales_order_for_new_records'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_require_sales_order_for_new_records
      CHECK (
        source_type IN ('master', 'excel_import', 'legacy')
        OR sales_order_id IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sales_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
