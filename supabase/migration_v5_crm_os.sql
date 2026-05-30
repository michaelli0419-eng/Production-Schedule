-- =============================================================================
-- SCM Hub — Migration v3: CRM-to-Production OS Complete Schema
-- Extends: production_lines, jobs, user_profiles, clients,
--          sales_pipeline_deals, contacts, submittals, activity_log, documents
-- Creates: companies, leads, opportunities, opportunity_competitors,
--          crm_activities, crm_tasks, quotes, quote_line_items,
--          quote_revisions, quote_approvals, job_milestones, job_materials,
--          job_attachments, departments, routing_templates, routing_steps,
--          job_routing_steps, resources, capacity_rules, capacity_blocks,
--          scheduled_tasks, schedule_conflicts, materials,
--          material_requirements, procurement_orders, procurement_order_lines,
--          external_id_map, netsuite_sync_log, procore_sync_log,
--          webhook_events, intake_drafts
-- Seeds:   departments (6 per line x 4 lines), capacity_rules, roles
-- Backfills: opportunities from sales_pipeline_deals
-- =============================================================================

-- Utility: auto-update updated_at (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- =============================================================================
-- MODULE 1: CRM
-- =============================================================================

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_client_id    UUID        REFERENCES clients(id) ON DELETE SET NULL,
    name                TEXT        NOT NULL,
    short_name          TEXT,
    type                TEXT        CHECK (type IN ('district','charter','private','contractor','subcontractor','vendor','other')),
    industry            TEXT,
    website             TEXT,
    phone               TEXT,
    fax                 TEXT,
    billing_address     JSONB,
    shipping_address    JSONB,
    annual_revenue      NUMERIC(16,2),
    employee_count      INT,
    territory           TEXT,
    owner_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    netsuite_entity_id  TEXT,
    procore_company_id  BIGINT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    tags                TEXT[]      DEFAULT '{}',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name     ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_type     ON companies(type);
CREATE INDEX IF NOT EXISTS idx_companies_owner    ON companies(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_netsuite ON companies(netsuite_entity_id) WHERE netsuite_entity_id IS NOT NULL;

DROP TRIGGER IF EXISTS companies_upd ON companies;
CREATE TRIGGER companies_upd BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_companies_all" ON companies;
CREATE POLICY "scm_companies_all" ON companies FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- contacts — extend existing table
-- -----------------------------------------------------------------------------
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS company_id         UUID        REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS first_name         TEXT,
    ADD COLUMN IF NOT EXISTS last_name          TEXT,
    ADD COLUMN IF NOT EXISTS mobile             TEXT,
    ADD COLUMN IF NOT EXISTS department         TEXT,
    ADD COLUMN IF NOT EXISTS linkedin           TEXT,
    ADD COLUMN IF NOT EXISTS is_primary         BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS do_not_contact     BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS owner_user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID        REFERENCES companies(id) ON DELETE SET NULL,
    contact_id              UUID        REFERENCES contacts(id) ON DELETE SET NULL,
    title                   TEXT        NOT NULL,
    source                  TEXT        CHECK (source IN ('referral','website','trade_show','cold_call','repeat_client','broker','other')),
    source_detail           TEXT,
    description             TEXT,
    assigned_to             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status                  TEXT        NOT NULL DEFAULT 'new'
                                        CHECK (status IN ('new','contacted','qualified','unqualified','converted','dead')),
    unqualified_reason      TEXT,
    estimated_value         NUMERIC(14,2),
    estimated_modules       INT,
    building_type           TEXT,
    delivery_date           DATE,
    location_city           TEXT,
    location_state          TEXT,
    converted_opportunity_id UUID,
    converted_at            TIMESTAMPTZ,
    created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_company  ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);

DROP TRIGGER IF EXISTS leads_upd ON leads;
CREATE TRIGGER leads_upd BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_leads_all" ON leads;
CREATE POLICY "scm_leads_all" ON leads FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- opportunities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunities (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_deal_id          TEXT        REFERENCES sales_pipeline_deals(id) ON DELETE SET NULL,
    opportunity_number      TEXT        UNIQUE,
    name                    TEXT        NOT NULL,
    company_id              UUID        REFERENCES companies(id) ON DELETE SET NULL,
    primary_contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
    stage                   TEXT        NOT NULL DEFAULT 'lead'
                                        CHECK (stage IN ('lead','qualify','estimate','proposal','negotiation','award','handoff','lost','dead')),
    probability             SMALLINT    NOT NULL DEFAULT 15 CHECK (probability BETWEEN 0 AND 100),
    close_reason            TEXT,
    contract_value          NUMERIC(14,2),
    weighted_value          NUMERIC(14,2) GENERATED ALWAYS AS
                                (ROUND(contract_value * probability / 100.0, 2)) STORED,
    margin_pct              NUMERIC(5,2),
    building_type           TEXT,
    module_count            INT,
    scope_summary           TEXT,
    delivery_city           TEXT,
    delivery_state          TEXT,
    bid_due_date            DATE,
    expected_award_date     DATE,
    expected_start_date     DATE,
    expected_occupancy_date DATE,
    bdm_user_id             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    estimator_user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    pm_user_id              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    bdm_name                TEXT,
    estimator_name          TEXT,
    pm_name                 TEXT,
    source_type             TEXT,
    source_sheet            TEXT,
    source_row              INT,
    converted_job_id        TEXT        REFERENCES jobs(id) ON DELETE SET NULL,
    converted_at            TIMESTAMPTZ,
    notes                   TEXT,
    tags                    TEXT[]      DEFAULT '{}',
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_company    ON opportunities(company_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage      ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opp_bdm        ON opportunities(bdm_user_id);
CREATE INDEX IF NOT EXISTS idx_opp_estimator  ON opportunities(estimator_user_id);
CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(expected_occupancy_date);
CREATE INDEX IF NOT EXISTS idx_opp_active     ON opportunities(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_opp_legacy     ON opportunities(legacy_deal_id) WHERE legacy_deal_id IS NOT NULL;

DROP TRIGGER IF EXISTS opp_upd ON opportunities;
CREATE TRIGGER opp_upd BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_opportunities_all" ON opportunities;
CREATE POLICY "scm_opportunities_all" ON opportunities FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- opportunity_competitors
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opportunity_competitors (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    competitor_name TEXT        NOT NULL,
    strength        TEXT        CHECK (strength IN ('weak','moderate','strong')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_competitors_opp ON opportunity_competitors(opportunity_id);

ALTER TABLE opportunity_competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_opp_competitors_all" ON opportunity_competitors;
CREATE POLICY "scm_opp_competitors_all" ON opportunity_competitors FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- crm_activities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_activities (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT        NOT NULL CHECK (entity_type IN ('lead','opportunity','company','contact','job')),
    entity_id       TEXT        NOT NULL,
    type            TEXT        NOT NULL CHECK (type IN ('call','email','meeting','site_visit','demo','note','task')),
    subject         TEXT        NOT NULL,
    body            TEXT,
    direction       TEXT        CHECK (direction IN ('inbound','outbound')),
    outcome         TEXT,
    scheduled_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    duration_min    INT,
    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_act_entity    ON crm_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_assigned  ON crm_activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_act_scheduled ON crm_activities(scheduled_at);

DROP TRIGGER IF EXISTS crm_activities_upd ON crm_activities;
CREATE TRIGGER crm_activities_upd BEFORE UPDATE ON crm_activities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_crm_activities_all" ON crm_activities;
CREATE POLICY "scm_crm_activities_all" ON crm_activities FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- crm_tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tasks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT        CHECK (entity_type IN ('lead','opportunity','company','contact','job','quote')),
    entity_id       TEXT,
    title           TEXT        NOT NULL,
    description     TEXT,
    status          TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','in_progress','done','cancelled')),
    priority        TEXT        NOT NULL DEFAULT 'Medium'
                                CHECK (priority IN ('Low','Medium','High','Critical')),
    due_date        DATE,
    reminder_at     TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_entity   ON crm_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due      ON crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status   ON crm_tasks(status) WHERE status <> 'done';

DROP TRIGGER IF EXISTS crm_tasks_upd ON crm_tasks;
CREATE TRIGGER crm_tasks_upd BEFORE UPDATE ON crm_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_crm_tasks_all" ON crm_tasks;
CREATE POLICY "scm_crm_tasks_all" ON crm_tasks FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 2: QUOTING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- quotes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    job_id          TEXT        REFERENCES jobs(id) ON DELETE SET NULL,
    quote_number    TEXT        NOT NULL UNIQUE,
    revision        SMALLINT    NOT NULL DEFAULT 1,
    status          TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','internal_review','sent','client_review','approved','rejected','superseded','expired')),
    title           TEXT        NOT NULL,
    description     TEXT,
    scope_inclusions TEXT,
    scope_exclusions TEXT,
    assumptions     TEXT,
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_pct    NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(14,2) DEFAULT 0,
    tax_pct         NUMERIC(5,2) DEFAULT 0,
    tax_amount      NUMERIC(14,2) DEFAULT 0,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0,
    margin_pct      NUMERIC(5,2),
    cost_total      NUMERIC(14,2),
    valid_from      DATE,
    valid_until     DATE,
    issued_date     DATE,
    accepted_date   DATE,
    lead_time_days  INT,
    delivery_date   DATE,
    install_scope   BOOLEAN     DEFAULT FALSE,
    prepared_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    netsuite_quote_id TEXT,
    netsuite_so_id  TEXT,
    notes           TEXT,
    internal_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status      ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number      ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_job         ON quotes(job_id);

DROP TRIGGER IF EXISTS quotes_upd ON quotes;
CREATE TRIGGER quotes_upd BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_quotes_all" ON quotes;
CREATE POLICY "scm_quotes_all" ON quotes FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- quote_line_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_line_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    sort_order      SMALLINT    NOT NULL DEFAULT 0,
    category        TEXT        CHECK (category IN ('module','site_work','electrical','plumbing','hvac','finishes','freight','install','option','allowance','other')),
    description     TEXT        NOT NULL,
    part_number     TEXT,
    unit            TEXT        DEFAULT 'ea',
    quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    extended_cost   NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_cost, 2)) STORED,
    extended_price  NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED,
    margin_pct      NUMERIC(5,2) GENERATED ALWAYS AS (
                        CASE WHEN unit_price = 0 THEN 0
                             ELSE ROUND((unit_price - unit_cost) / unit_price * 100, 2)
                        END) STORED,
    is_optional     BOOLEAN     DEFAULT FALSE,
    is_alternate    BOOLEAN     DEFAULT FALSE,
    is_included     BOOLEAN     DEFAULT TRUE,
    lead_time_days  INT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qli_quote ON quote_line_items(quote_id);

DROP TRIGGER IF EXISTS qli_upd ON quote_line_items;
CREATE TRIGGER qli_upd BEFORE UPDATE ON quote_line_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_qli_all" ON quote_line_items;
CREATE POLICY "scm_qli_all" ON quote_line_items FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- quote_revisions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_revisions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    revision_number SMALLINT    NOT NULL,
    snapshot        JSONB       NOT NULL,
    change_summary  TEXT,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (quote_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_qrev_quote ON quote_revisions(quote_id);

ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_qrev_all" ON quote_revisions;
CREATE POLICY "scm_qrev_all" ON quote_revisions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- quote_approvals
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_approvals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    step            SMALLINT    NOT NULL DEFAULT 1,
    role_required   TEXT        NOT NULL,
    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','skipped')),
    decision_at     TIMESTAMPTZ,
    comments        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (quote_id, step)
);

CREATE INDEX IF NOT EXISTS idx_qapproval_quote    ON quote_approvals(quote_id);
CREATE INDEX IF NOT EXISTS idx_qapproval_assigned ON quote_approvals(assigned_to);

ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_qapproval_all" ON quote_approvals;
CREATE POLICY "scm_qapproval_all" ON quote_approvals FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 3: PRODUCTION JOB EXTENSIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- job_milestones
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_milestones (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    milestone_type  TEXT        CHECK (milestone_type IN (
                        'permit','dsa_approval','materials_on_site','crew_ready',
                        'production_start','off_line','shipping','set','occupancy',
                        'substantial_completion','final_acceptance','other')),
    planned_date    DATE,
    actual_date     DATE,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','at_risk','complete','waived')),
    responsible_user UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_job  ON job_milestones(job_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON job_milestones(planned_date);

DROP TRIGGER IF EXISTS job_milestones_upd ON job_milestones;
CREATE TRIGGER job_milestones_upd BEFORE UPDATE ON job_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_job_milestones_all" ON job_milestones;
CREATE POLICY "scm_job_milestones_all" ON job_milestones FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- materials (must exist before job_materials references it)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number             TEXT        UNIQUE,
    name                    TEXT        NOT NULL,
    description             TEXT,
    category                TEXT        CHECK (category IN ('structural','electrical','plumbing','hvac','finishes','hardware','glazing','roofing','consumable','other')),
    unit                    TEXT        NOT NULL DEFAULT 'ea',
    unit_cost               NUMERIC(12,2),
    list_price              NUMERIC(12,2),
    lead_time_days          INT         DEFAULT 0,
    reorder_point           NUMERIC(10,3),
    preferred_supplier      TEXT,
    supplier_part_number    TEXT,
    netsuite_item_id        TEXT,
    is_active               BOOLEAN     DEFAULT TRUE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_part      ON materials(part_number);
CREATE INDEX IF NOT EXISTS idx_materials_netsuite  ON materials(netsuite_item_id);

DROP TRIGGER IF EXISTS materials_upd ON materials;
CREATE TRIGGER materials_upd BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_materials_all" ON materials;
CREATE POLICY "scm_materials_all" ON materials FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- job_materials
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_materials (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    material_id         UUID        REFERENCES materials(id) ON DELETE SET NULL,
    description         TEXT        NOT NULL,
    part_number         TEXT,
    category            TEXT        CHECK (category IN ('structural','electrical','plumbing','hvac','finishes','hardware','glazing','roofing','other')),
    unit                TEXT        DEFAULT 'ea',
    quantity_required   NUMERIC(10,3) NOT NULL DEFAULT 1,
    quantity_on_hand    NUMERIC(10,3) DEFAULT 0,
    quantity_ordered    NUMERIC(10,3) DEFAULT 0,
    unit_cost           NUMERIC(12,2),
    extended_cost       NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity_required * unit_cost, 2)) STORED,
    lead_time_days      INT,
    required_by_date    DATE,
    procurement_status  TEXT        NOT NULL DEFAULT 'not_ordered'
                                    CHECK (procurement_status IN ('not_ordered','ordered','partial','received','complete','on_hold')),
    supplier_name       TEXT,
    po_number           TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_materials_job      ON job_materials(job_id);
CREATE INDEX IF NOT EXISTS idx_job_materials_status   ON job_materials(procurement_status);
CREATE INDEX IF NOT EXISTS idx_job_materials_required ON job_materials(required_by_date);

DROP TRIGGER IF EXISTS job_materials_upd ON job_materials;
CREATE TRIGGER job_materials_upd BEFORE UPDATE ON job_materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_job_materials_all" ON job_materials;
CREATE POLICY "scm_job_materials_all" ON job_materials FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- job_attachments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_attachments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    category        TEXT        CHECK (category IN ('drawing','photo','spec','permit','approval','correspondence','report','contract','other')),
    name            TEXT        NOT NULL,
    storage_path    TEXT        NOT NULL,
    file_type       TEXT,
    file_size_kb    INT,
    version         TEXT,
    revision_date   DATE,
    is_current      BOOLEAN     DEFAULT TRUE,
    source          TEXT        CHECK (source IN ('upload','procore','email','other')),
    uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_attachments_job      ON job_attachments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_attachments_category ON job_attachments(category);

ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_job_attachments_all" ON job_attachments;
CREATE POLICY "scm_job_attachments_all" ON job_attachments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 4: ROUTING ENGINE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- departments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT        NOT NULL UNIQUE,
    code                TEXT        NOT NULL UNIQUE,
    production_line_id  TEXT        REFERENCES production_lines(id) ON DELETE SET NULL,
    sort_order          SMALLINT    DEFAULT 0,
    is_active           BOOLEAN     DEFAULT TRUE,
    color               TEXT        DEFAULT '#3b82f6',
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_line ON departments(production_line_id);

DROP TRIGGER IF EXISTS departments_upd ON departments;
CREATE TRIGGER departments_upd BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_departments_all" ON departments;
CREATE POLICY "scm_departments_all" ON departments FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Seed departments: 6 per line x 4 lines
INSERT INTO departments (name, code, production_line_id, sort_order, color) VALUES
    ('L1 Engineering',    'L1-ENG',  'L1', 1, '#6366f1'),
    ('L1 Procurement',    'L1-PRO',  'L1', 2, '#8b5cf6'),
    ('L1 Fabrication',    'L1-FAB',  'L1', 3, '#ec4899'),
    ('L1 Assembly',       'L1-ASM',  'L1', 4, '#f59e0b'),
    ('L1 QC',             'L1-QC',   'L1', 5, '#10b981'),
    ('L1 Shipping',       'L1-SHP',  'L1', 6, '#3b82f6'),
    ('L2 Engineering',    'L2-ENG',  'L2', 1, '#6366f1'),
    ('L2 Procurement',    'L2-PRO',  'L2', 2, '#8b5cf6'),
    ('L2 Fabrication',    'L2-FAB',  'L2', 3, '#ec4899'),
    ('L2 Assembly',       'L2-ASM',  'L2', 4, '#f59e0b'),
    ('L2 QC',             'L2-QC',   'L2', 5, '#10b981'),
    ('L2 Shipping',       'L2-SHP',  'L2', 6, '#3b82f6'),
    ('L3 Engineering',    'L3-ENG',  'L3', 1, '#6366f1'),
    ('L3 Procurement',    'L3-PRO',  'L3', 2, '#8b5cf6'),
    ('L3 Fabrication',    'L3-FAB',  'L3', 3, '#ec4899'),
    ('L3 Assembly',       'L3-ASM',  'L3', 4, '#f59e0b'),
    ('L3 QC',             'L3-QC',   'L3', 5, '#10b981'),
    ('L3 Shipping',       'L3-SHP',  'L3', 6, '#3b82f6'),
    ('L4 Engineering',    'L4-ENG',  'L4', 1, '#6366f1'),
    ('L4 Procurement',    'L4-PRO',  'L4', 2, '#8b5cf6'),
    ('L4 Fabrication',    'L4-FAB',  'L4', 3, '#ec4899'),
    ('L4 Assembly',       'L4-ASM',  'L4', 4, '#f59e0b'),
    ('L4 QC',             'L4-QC',   'L4', 5, '#10b981'),
    ('L4 Shipping',       'L4-SHP',  'L4', 6, '#3b82f6')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- routing_templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routing_templates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    code            TEXT        UNIQUE,
    description     TEXT,
    building_type   TEXT,
    module_range_min INT,
    module_range_max INT,
    is_active       BOOLEAN     DEFAULT TRUE,
    version         SMALLINT    DEFAULT 1,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS routing_templates_upd ON routing_templates;
CREATE TRIGGER routing_templates_upd BEFORE UPDATE ON routing_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE routing_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_routing_templates_all" ON routing_templates;
CREATE POLICY "scm_routing_templates_all" ON routing_templates FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- routing_steps
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routing_steps (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID        NOT NULL REFERENCES routing_templates(id) ON DELETE CASCADE,
    department_id       UUID        REFERENCES departments(id) ON DELETE SET NULL,
    step_number         SMALLINT    NOT NULL,
    name                TEXT        NOT NULL,
    description         TEXT,
    duration_type       TEXT        NOT NULL DEFAULT 'per_module'
                                    CHECK (duration_type IN ('fixed','per_module','per_crew_day')),
    duration_hours      NUMERIC(8,2) NOT NULL DEFAULT 8,
    setup_hours         NUMERIC(6,2) DEFAULT 0,
    teardown_hours      NUMERIC(6,2) DEFAULT 0,
    parallel_group      SMALLINT,
    predecessor_step    SMALLINT,
    lag_hours           NUMERIC(6,2) DEFAULT 0,
    crew_required       SMALLINT    DEFAULT 1,
    equipment_notes     TEXT,
    is_inspection_point BOOLEAN     DEFAULT FALSE,
    is_active           BOOLEAN     DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_routing_steps_template ON routing_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_routing_steps_dept     ON routing_steps(department_id);

DROP TRIGGER IF EXISTS routing_steps_upd ON routing_steps;
CREATE TRIGGER routing_steps_upd BEFORE UPDATE ON routing_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE routing_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_routing_steps_all" ON routing_steps;
CREATE POLICY "scm_routing_steps_all" ON routing_steps FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- job_routing_steps
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_routing_steps (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    template_step_id    UUID        REFERENCES routing_steps(id) ON DELETE SET NULL,
    department_id       UUID        REFERENCES departments(id) ON DELETE SET NULL,
    step_number         SMALLINT    NOT NULL,
    name                TEXT        NOT NULL,
    planned_start       TIMESTAMPTZ,
    planned_end         TIMESTAMPTZ,
    planned_hours       NUMERIC(8,2),
    actual_start        TIMESTAMPTZ,
    actual_end          TIMESTAMPTZ,
    actual_hours        NUMERIC(8,2),
    status              TEXT        NOT NULL DEFAULT 'not_started'
                                    CHECK (status IN ('not_started','ready','in_progress','complete','skipped','blocked')),
    percent_complete    SMALLINT    DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
    crew_assigned       SMALLINT    DEFAULT 0,
    assigned_user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_jrs_job          ON job_routing_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_jrs_dept         ON job_routing_steps(department_id);
CREATE INDEX IF NOT EXISTS idx_jrs_status       ON job_routing_steps(status);
CREATE INDEX IF NOT EXISTS idx_jrs_planned_start ON job_routing_steps(planned_start);

DROP TRIGGER IF EXISTS jrs_upd ON job_routing_steps;
CREATE TRIGGER jrs_upd BEFORE UPDATE ON job_routing_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_routing_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_jrs_all" ON job_routing_steps;
CREATE POLICY "scm_jrs_all" ON job_routing_steps FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 5: CAPACITY PLANNING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- resources
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
    name            TEXT        NOT NULL,
    code            TEXT,
    type            TEXT        NOT NULL DEFAULT 'person'
                                CHECK (type IN ('person','machine','tool','subcontractor')),
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    skill_level     TEXT        CHECK (skill_level IN ('apprentice','journeyman','foreman','lead')),
    hourly_rate     NUMERIC(8,2),
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_dept ON resources(department_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);

DROP TRIGGER IF EXISTS resources_upd ON resources;
CREATE TRIGGER resources_upd BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_resources_all" ON resources;
CREATE POLICY "scm_resources_all" ON resources FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- capacity_rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacity_rules (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    effective_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    expires_date    DATE,
    shifts_per_day  SMALLINT    NOT NULL DEFAULT 1,
    hours_per_shift NUMERIC(4,2) NOT NULL DEFAULT 8,
    days_per_week   SMALLINT    NOT NULL DEFAULT 5,
    crew_size       SMALLINT    NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_rules_dept ON capacity_rules(department_id);
CREATE INDEX IF NOT EXISTS idx_cap_rules_date ON capacity_rules(effective_date);

DROP TRIGGER IF EXISTS cap_rules_upd ON capacity_rules;
CREATE TRIGGER cap_rules_upd BEFORE UPDATE ON capacity_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE capacity_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_cap_rules_all" ON capacity_rules;
CREATE POLICY "scm_cap_rules_all" ON capacity_rules FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Seed capacity_rules: 1 shift, 8h, 5 days, 75 crew per line (split across 6 depts)
-- Each line has 75 total crew; allocate per department (approximate split):
-- Engineering=5, Procurement=5, Fabrication=25, Assembly=25, QC=10, Shipping=5
DO $$
DECLARE
    dept_rec RECORD;
    crew_map JSONB := '{
        "ENG": 5, "PRO": 5, "FAB": 25, "ASM": 25, "QC": 10, "SHP": 5
    }';
    dept_suffix TEXT;
    crew_val SMALLINT;
BEGIN
    FOR dept_rec IN SELECT id, code FROM departments LOOP
        dept_suffix := SPLIT_PART(dept_rec.code, '-', 2);
        crew_val := (crew_map ->> dept_suffix)::SMALLINT;
        IF crew_val IS NULL THEN crew_val := 1; END IF;
        INSERT INTO capacity_rules (department_id, effective_date, shifts_per_day, hours_per_shift, days_per_week, crew_size, notes)
        VALUES (dept_rec.id, CURRENT_DATE, 1, 8, 5, crew_val, 'Seed: Phase 1 baseline')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- capacity_blocks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacity_blocks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        REFERENCES departments(id) ON DELETE CASCADE,
    block_date      DATE        NOT NULL,
    block_type      TEXT        NOT NULL DEFAULT 'holiday'
                                CHECK (block_type IN ('holiday','shutdown','reduced','overtime','training')),
    capacity_pct    SMALLINT    NOT NULL DEFAULT 0 CHECK (capacity_pct BETWEEN 0 AND 200),
    name            TEXT        NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cap_blocks_date ON capacity_blocks(block_date);
CREATE INDEX IF NOT EXISTS idx_cap_blocks_dept ON capacity_blocks(department_id);

ALTER TABLE capacity_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_cap_blocks_all" ON capacity_blocks;
CREATE POLICY "scm_cap_blocks_all" ON capacity_blocks FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 6: SCHEDULING
-- =============================================================================

-- -----------------------------------------------------------------------------
-- scheduled_tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_routing_step_id     UUID        REFERENCES job_routing_steps(id) ON DELETE SET NULL,
    department_id           UUID        REFERENCES departments(id) ON DELETE SET NULL,
    resource_id             UUID        REFERENCES resources(id) ON DELETE SET NULL,
    title                   TEXT        NOT NULL,
    scheduled_start         TIMESTAMPTZ NOT NULL,
    scheduled_end           TIMESTAMPTZ NOT NULL,
    duration_hours          NUMERIC(6,2) GENERATED ALWAYS AS (
                                EXTRACT(EPOCH FROM (scheduled_end - scheduled_start)) / 3600
                            ) STORED,
    actual_start            TIMESTAMPTZ,
    actual_end              TIMESTAMPTZ,
    actual_hours            NUMERIC(6,2),
    status                  TEXT        NOT NULL DEFAULT 'scheduled'
                                        CHECK (status IN ('scheduled','confirmed','in_progress','complete','cancelled','no_show')),
    priority                TEXT        DEFAULT 'Medium'
                                        CHECK (priority IN ('Low','Medium','High','Critical')),
    is_milestone            BOOLEAN     DEFAULT FALSE,
    requires_inspection     BOOLEAN     DEFAULT FALSE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_sched_tasks_job      ON scheduled_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_resource ON scheduled_tasks(resource_id);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_dept     ON scheduled_tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_start    ON scheduled_tasks(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_status   ON scheduled_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sched_tasks_dispatch ON scheduled_tasks(scheduled_start, department_id, status);

DROP TRIGGER IF EXISTS sched_tasks_upd ON scheduled_tasks;
CREATE TRIGGER sched_tasks_upd BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_sched_tasks_all" ON scheduled_tasks;
CREATE POLICY "scm_sched_tasks_all" ON scheduled_tasks FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- schedule_conflicts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_conflicts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_type   TEXT        NOT NULL CHECK (conflict_type IN (
                        'resource_double_book','line_overlap','capacity_exceeded',
                        'dependency_violated','late_delivery','readiness_gap')),
    severity        TEXT        NOT NULL DEFAULT 'warning'
                                CHECK (severity IN ('info','warning','critical')),
    task_a_id       UUID        REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    task_b_id       UUID        REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    job_a_id        TEXT        REFERENCES jobs(id) ON DELETE CASCADE,
    job_b_id        TEXT        REFERENCES jobs(id) ON DELETE CASCADE,
    resource_id     UUID        REFERENCES resources(id) ON DELETE SET NULL,
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
    overlap_start   TIMESTAMPTZ,
    overlap_end     TIMESTAMPTZ,
    detail          TEXT,
    is_resolved     BOOLEAN     DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_job_a      ON schedule_conflicts(job_a_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_job_b      ON schedule_conflicts(job_b_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_resource   ON schedule_conflicts(resource_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON schedule_conflicts(is_resolved) WHERE is_resolved = FALSE;

DROP TRIGGER IF EXISTS conflicts_upd ON schedule_conflicts;
CREATE TRIGGER conflicts_upd BEFORE UPDATE ON schedule_conflicts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE schedule_conflicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_conflicts_all" ON schedule_conflicts;
CREATE POLICY "scm_conflicts_all" ON schedule_conflicts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 7: MATERIAL PLANNING (materials already created above)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- material_requirements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_requirements (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_material_id     UUID        REFERENCES job_materials(id) ON DELETE SET NULL,
    material_id         UUID        REFERENCES materials(id) ON DELETE SET NULL,
    description         TEXT        NOT NULL,
    quantity_required   NUMERIC(10,3) NOT NULL,
    quantity_allocated  NUMERIC(10,3) DEFAULT 0,
    quantity_received   NUMERIC(10,3) DEFAULT 0,
    unit                TEXT        DEFAULT 'ea',
    unit_cost           NUMERIC(12,2),
    required_by_date    DATE,
    status              TEXT        NOT NULL DEFAULT 'open'
                                    CHECK (status IN ('open','partially_ordered','fully_ordered','partially_received','received','cancelled')),
    priority            TEXT        DEFAULT 'Medium'
                                    CHECK (priority IN ('Low','Medium','High','Critical')),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mat_req_job      ON material_requirements(job_id);
CREATE INDEX IF NOT EXISTS idx_mat_req_material ON material_requirements(material_id);
CREATE INDEX IF NOT EXISTS idx_mat_req_status   ON material_requirements(status);
CREATE INDEX IF NOT EXISTS idx_mat_req_date     ON material_requirements(required_by_date);

DROP TRIGGER IF EXISTS mat_req_upd ON material_requirements;
CREATE TRIGGER mat_req_upd BEFORE UPDATE ON material_requirements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE material_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_mat_req_all" ON material_requirements;
CREATE POLICY "scm_mat_req_all" ON material_requirements FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- procurement_orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_orders (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number       TEXT        NOT NULL UNIQUE,
    netsuite_po_id  TEXT,
    supplier_name   TEXT        NOT NULL,
    supplier_contact TEXT,
    supplier_email  TEXT,
    status          TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','submitted','confirmed','partial_receipt','received','cancelled','closed')),
    order_date      DATE,
    required_date   DATE,
    expected_date   DATE,
    received_date   DATE,
    subtotal        NUMERIC(14,2) DEFAULT 0,
    tax             NUMERIC(14,2) DEFAULT 0,
    shipping        NUMERIC(14,2) DEFAULT 0,
    total           NUMERIC(14,2) DEFAULT 0,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_status   ON procurement_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON procurement_orders(supplier_name);
CREATE INDEX IF NOT EXISTS idx_po_required ON procurement_orders(required_date);
CREATE INDEX IF NOT EXISTS idx_po_netsuite ON procurement_orders(netsuite_po_id);

DROP TRIGGER IF EXISTS po_upd ON procurement_orders;
CREATE TRIGGER po_upd BEFORE UPDATE ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE procurement_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_po_all" ON procurement_orders;
CREATE POLICY "scm_po_all" ON procurement_orders FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- procurement_order_lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procurement_order_lines (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id               UUID        NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
    requirement_id      UUID        REFERENCES material_requirements(id) ON DELETE SET NULL,
    material_id         UUID        REFERENCES materials(id) ON DELETE SET NULL,
    line_number         SMALLINT    NOT NULL,
    description         TEXT        NOT NULL,
    part_number         TEXT,
    unit                TEXT        DEFAULT 'ea',
    quantity_ordered    NUMERIC(10,3) NOT NULL,
    quantity_received   NUMERIC(10,3) DEFAULT 0,
    unit_cost           NUMERIC(12,2) NOT NULL,
    extended_cost       NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity_ordered * unit_cost, 2)) STORED,
    received_date       DATE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (po_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_pol_po          ON procurement_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_pol_requirement ON procurement_order_lines(requirement_id);
CREATE INDEX IF NOT EXISTS idx_pol_material    ON procurement_order_lines(material_id);

ALTER TABLE procurement_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_pol_all" ON procurement_order_lines;
CREATE POLICY "scm_pol_all" ON procurement_order_lines FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 8: INTEGRATION LAYER
-- =============================================================================

-- -----------------------------------------------------------------------------
-- external_id_map
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_id_map (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    system          TEXT        NOT NULL CHECK (system IN ('netsuite','procore','excel','salesforce','other')),
    external_id     TEXT        NOT NULL,
    entity_type     TEXT        NOT NULL,
    internal_id     TEXT        NOT NULL,
    sync_direction  TEXT        DEFAULT 'bidirectional'
                                CHECK (sync_direction IN ('inbound','outbound','bidirectional')),
    last_synced_at  TIMESTAMPTZ,
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (system, external_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_ext_map_system   ON external_id_map(system, entity_type);
CREATE INDEX IF NOT EXISTS idx_ext_map_internal ON external_id_map(entity_type, internal_id);

ALTER TABLE external_id_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_ext_map_all" ON external_id_map;
CREATE POLICY "scm_ext_map_all" ON external_id_map FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- netsuite_sync_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS netsuite_sync_log (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type      TEXT        NOT NULL,
    internal_id      TEXT        NOT NULL,
    netsuite_id      TEXT,
    operation        TEXT        NOT NULL CHECK (operation IN ('create','update','delete','read','upsert')),
    direction        TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
    status           TEXT        NOT NULL CHECK (status IN ('success','error','skipped','pending')),
    http_status      INT,
    request_payload  JSONB,
    response_payload JSONB,
    error_message    TEXT,
    triggered_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    duration_ms      INT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ns_log_entity  ON netsuite_sync_log(entity_type, internal_id);
CREATE INDEX IF NOT EXISTS idx_ns_log_status  ON netsuite_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_ns_log_created ON netsuite_sync_log(created_at DESC);

ALTER TABLE netsuite_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_ns_log_all" ON netsuite_sync_log;
CREATE POLICY "scm_ns_log_all" ON netsuite_sync_log FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- procore_sync_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS procore_sync_log (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  TEXT        REFERENCES jobs(id) ON DELETE SET NULL,
    procore_project_id      BIGINT,
    job_number              TEXT,
    triggered_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    trigger_type            TEXT        NOT NULL DEFAULT 'manual'
                                        CHECK (trigger_type IN ('manual','webhook','scheduled','bulk')),
    submittals_synced       INT         DEFAULT 0,
    rfis_synced             INT         DEFAULT 0,
    punch_items_synced      INT         DEFAULT 0,
    change_events_synced    INT         DEFAULT 0,
    inspections_synced      INT         DEFAULT 0,
    observations_synced     INT         DEFAULT 0,
    status                  TEXT        NOT NULL CHECK (status IN ('success','partial','error')),
    error_message           TEXT,
    duration_ms             INT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procore_log_job     ON procore_sync_log(job_id);
CREATE INDEX IF NOT EXISTS idx_procore_log_created ON procore_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_procore_log_status  ON procore_sync_log(status);

ALTER TABLE procore_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_procore_log_all" ON procore_sync_log;
CREATE POLICY "scm_procore_log_all" ON procore_sync_log FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- -----------------------------------------------------------------------------
-- webhook_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source              TEXT        NOT NULL CHECK (source IN ('procore','netsuite','other')),
    event_type          TEXT        NOT NULL,
    external_id         TEXT,
    procore_project_id  BIGINT,
    payload             JSONB       NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','processing','processed','failed','ignored')),
    processed_at        TIMESTAMPTZ,
    error_message       TEXT,
    retry_count         SMALLINT    DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_status  ON webhook_events(status) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_webhook_source  ON webhook_events(source, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_created ON webhook_events(created_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_webhook_all" ON webhook_events;
CREATE POLICY "scm_webhook_all" ON webhook_events FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- MODULE 9: INTAKE DRAFTS
-- Holds in-progress form data before formal lead/opportunity creation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS intake_drafts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_type      TEXT        NOT NULL DEFAULT 'opportunity'
                                CHECK (draft_type IN ('lead','opportunity','quote','job')),
    title           TEXT,
    owner_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    data            JSONB       NOT NULL DEFAULT '{}',
    step            SMALLINT    DEFAULT 1,
    is_submitted    BOOLEAN     DEFAULT FALSE,
    submitted_at    TIMESTAMPTZ,
    resulting_id    TEXT,       -- UUID or TEXT pk of the created record after submission
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_drafts_owner  ON intake_drafts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_intake_drafts_type   ON intake_drafts(draft_type);
CREATE INDEX IF NOT EXISTS idx_intake_drafts_active ON intake_drafts(is_submitted) WHERE is_submitted = FALSE;

DROP TRIGGER IF EXISTS intake_drafts_upd ON intake_drafts;
CREATE TRIGGER intake_drafts_upd BEFORE UPDATE ON intake_drafts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE intake_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scm_intake_drafts_all" ON intake_drafts;
CREATE POLICY "scm_intake_drafts_all" ON intake_drafts FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- =============================================================================
-- SEQUENCES / AUTO-NUMBER
-- =============================================================================

-- Seed opportunity_number_seq from existing deal count
DO $$
DECLARE deal_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO deal_count FROM sales_pipeline_deals;
    IF deal_count < 1 THEN deal_count := 0; END IF;
    -- Create sequence if not exists, then advance to deal_count + 1
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'opportunity_number_seq') THEN
        EXECUTE 'CREATE SEQUENCE opportunity_number_seq START ' || (deal_count + 1);
    END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_number_seq    START 1;

-- opportunity_number auto-generation trigger
CREATE OR REPLACE FUNCTION generate_opportunity_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.opportunity_number IS NULL THEN
        NEW.opportunity_number := 'OPP-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('opportunity_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opp_number_gen ON opportunities;
CREATE TRIGGER opp_number_gen BEFORE INSERT ON opportunities
    FOR EACH ROW EXECUTE FUNCTION generate_opportunity_number();

-- quote_number auto-generation trigger
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quote_number IS NULL THEN
        NEW.quote_number := 'Q-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('quote_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_number_gen ON quotes;
CREATE TRIGGER quote_number_gen BEFORE INSERT ON quotes
    FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

-- po_number auto-generation trigger
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.po_number IS NULL THEN
        NEW.po_number := 'PO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
            LPAD(NEXTVAL('po_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS po_number_gen ON procurement_orders;
CREATE TRIGGER po_number_gen BEFORE INSERT ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION generate_po_number();

-- =============================================================================
-- BACKFILL: sales_pipeline_deals → opportunities
-- Maps deal stage to opportunity stage; probability from deals;
-- preserves legacy_deal_id for traceability.
-- =============================================================================
INSERT INTO opportunities (
    legacy_deal_id,
    name,
    stage,
    probability,
    contract_value,
    building_type,
    module_count,
    delivery_state,
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
    d.id                                                AS legacy_deal_id,
    d.opportunity_name                                  AS name,
    CASE d.stage
        WHEN 'lead'     THEN 'lead'
        WHEN 'estimate' THEN 'estimate'
        WHEN 'proposal' THEN 'proposal'
        WHEN 'award'    THEN 'award'
        WHEN 'handoff'  THEN 'handoff'
        ELSE 'lead'
    END                                                 AS stage,
    d.probability::SMALLINT                             AS probability,
    d.amount                                            AS contract_value,
    d.building_type,
    d.modules                                           AS module_count,
    NULL                                                AS delivery_state,
    d.expected_close_date                               AS bid_due_date,
    d.expected_close_date                               AS expected_occupancy_date,
    d.bdm                                               AS bdm_name,
    d.estimator                                         AS estimator_name,
    d.project_manager                                   AS pm_name,
    d.source_type,
    d.source_sheet,
    d.source_row,
    d.converted_job_id_fk                               AS converted_job_id,
    d.converted_at,
    d.notes,
    TRUE                                                AS is_active,
    d.created_at,
    d.updated_at
FROM sales_pipeline_deals d
WHERE NOT EXISTS (
    SELECT 1 FROM opportunities o WHERE o.legacy_deal_id = d.id
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- REALTIME PUBLICATIONS
-- =============================================================================
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'companies',
        'contacts',
        'leads',
        'opportunities',
        'jobs',
        'job_routing_steps',
        'scheduled_tasks',
        'schedule_conflicts',
        'material_requirements',
        'procurement_orders',
        'webhook_events',
        'crm_activities'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname    = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename  = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- SCHEMA CACHE RELOAD
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION v3
-- New tables: companies, leads, opportunities, opportunity_competitors,
--   crm_activities, crm_tasks, quotes, quote_line_items, quote_revisions,
--   quote_approvals, job_milestones, job_materials, job_attachments,
--   departments, routing_templates, routing_steps, job_routing_steps,
--   resources, capacity_rules, capacity_blocks, scheduled_tasks,
--   schedule_conflicts, materials, material_requirements,
--   procurement_orders, procurement_order_lines, external_id_map,
--   netsuite_sync_log, procore_sync_log, webhook_events, intake_drafts
-- Extended: contacts (company_id, first_name, last_name, mobile, dept, etc.)
-- Seeded: 24 departments (6 per line), capacity_rules (75 crew/line)
-- Backfilled: opportunities from sales_pipeline_deals
-- =============================================================================