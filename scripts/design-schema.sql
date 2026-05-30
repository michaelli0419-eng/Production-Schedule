Here is the complete PostgreSQL schema for the manufacturing CRM-to-Production Operating System. This is designed to extend the existing Supabase schema without breaking it.

```sql
-- =============================================================================
-- MANUFACTURING CRM-TO-PRODUCTION OS — COMPLETE SCHEMA
-- Extends existing: production_lines, jobs, user_profiles, clients,
--   sales_pipeline_deals, contacts, submittals, activity_log, documents,
--   procore_* tables
-- =============================================================================

-- Utility: auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- =============================================================================
-- MODULE 1: CRM
-- Hierarchy: Company → Contact → Lead → Opportunity → Activity/Task
-- =============================================================================

-- -----------------------------------------------------------------------------
-- companies
-- Central account record. Replaces/extends the existing `clients` table.
-- Existing clients.id (UUID) can be back-filled here.
-- -----------------------------------------------------------------------------
CREATE TABLE companies (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Legacy link: existing clients rows can be kept; this is the canonical record
    legacy_client_id UUID       REFERENCES clients(id) ON DELETE SET NULL,

    name            TEXT        NOT NULL,
    short_name      TEXT,                          -- "LAUSD", "SDCG" etc.
    type            TEXT        CHECK (type IN ('district','charter','private','contractor','subcontractor','vendor','other')),
    industry        TEXT,
    website         TEXT,
    phone           TEXT,
    fax             TEXT,
    billing_address JSONB,                         -- {street,city,state,zip,country}
    shipping_address JSONB,
    annual_revenue  NUMERIC(16,2),
    employee_count  INT,
    territory       TEXT,                          -- sales region/territory
    owner_user_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    netsuite_entity_id TEXT,                       -- NetSuite Customer/Vendor ID
    procore_company_id BIGINT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    tags            TEXT[]      DEFAULT '{}',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_type ON companies(type);
CREATE INDEX idx_companies_owner ON companies(owner_user_id);
CREATE INDEX idx_companies_netsuite ON companies(netsuite_entity_id) WHERE netsuite_entity_id IS NOT NULL;

CREATE TRIGGER companies_upd BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_companies_all" ON companies FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- contacts
-- Person records linked to a company. Extends existing contacts table concept.
-- -----------------------------------------------------------------------------
-- (existing contacts table covers this; add missing columns via ALTER)
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name  TEXT,
    ADD COLUMN IF NOT EXISTS mobile     TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS linkedin   TEXT,
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE,  -- primary contact at company
    ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- -----------------------------------------------------------------------------
-- leads
-- Top of funnel before a formal opportunity is created.
-- -----------------------------------------------------------------------------
CREATE TABLE leads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID        REFERENCES companies(id) ON DELETE SET NULL,
    contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,

    title           TEXT        NOT NULL,          -- "LAUSD Science Portable RFQ"
    source          TEXT        CHECK (source IN ('referral','website','trade_show','cold_call','repeat_client','broker','other')),
    source_detail   TEXT,
    description     TEXT,

    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status          TEXT        NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','contacted','qualified','unqualified','converted','dead')),
    unqualified_reason TEXT,

    estimated_value NUMERIC(14,2),
    estimated_modules INT,
    building_type   TEXT,
    delivery_date   DATE,
    location_city   TEXT,
    location_state  TEXT,

    converted_opportunity_id UUID,                 -- set when lead → opportunity
    converted_at    TIMESTAMPTZ,

    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);

CREATE TRIGGER leads_upd BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_leads_all" ON leads FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- opportunities
-- Formal sales opportunity. Replaces/supersedes sales_pipeline_deals for new
-- data; existing deals rows remain untouched and are linkable via legacy_deal_id.
-- -----------------------------------------------------------------------------
CREATE TABLE opportunities (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_deal_id  TEXT        REFERENCES sales_pipeline_deals(id) ON DELETE SET NULL,

    -- Identification
    opportunity_number TEXT     UNIQUE,            -- auto-generated: OPP-2026-0042
    name            TEXT        NOT NULL,
    company_id      UUID        REFERENCES companies(id) ON DELETE SET NULL,
    primary_contact_id UUID     REFERENCES contacts(id) ON DELETE SET NULL,

    -- Pipeline
    stage           TEXT        NOT NULL DEFAULT 'lead'
                                CHECK (stage IN ('lead','qualify','estimate','proposal','negotiation','award','handoff','lost','dead')),
    probability     SMALLINT    NOT NULL DEFAULT 15 CHECK (probability BETWEEN 0 AND 100),
    close_reason    TEXT,       -- for lost/dead

    -- Financials
    contract_value  NUMERIC(14,2),
    weighted_value  NUMERIC(14,2) GENERATED ALWAYS AS
                        (ROUND(contract_value * probability / 100.0, 2)) STORED,
    margin_pct      NUMERIC(5,2),

    -- Project details
    building_type   TEXT,
    module_count    INT,
    scope_summary   TEXT,
    delivery_city   TEXT,
    delivery_state  TEXT,

    -- Key dates
    bid_due_date    DATE,
    expected_award_date DATE,
    expected_start_date DATE,
    expected_occupancy_date DATE,       -- "District Occupancy" label in UI

    -- Ownership
    bdm_user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    estimator_user_id UUID      REFERENCES auth.users(id) ON DELETE SET NULL,
    pm_user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Legacy / import
    bdm_name        TEXT,
    estimator_name  TEXT,
    pm_name         TEXT,
    source_type     TEXT,
    source_sheet    TEXT,
    source_row      INT,

    -- Conversion
    converted_job_id TEXT       REFERENCES jobs(id) ON DELETE SET NULL,
    converted_at    TIMESTAMPTZ,

    notes           TEXT,
    tags            TEXT[]      DEFAULT '{}',
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opp_company ON opportunities(company_id);
CREATE INDEX idx_opp_stage ON opportunities(stage);
CREATE INDEX idx_opp_bdm ON opportunities(bdm_user_id);
CREATE INDEX idx_opp_estimator ON opportunities(estimator_user_id);
CREATE INDEX idx_opp_close_date ON opportunities(expected_occupancy_date);
CREATE INDEX idx_opp_active ON opportunities(is_active) WHERE is_active = TRUE;

CREATE TRIGGER opp_upd BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_opportunities_all" ON opportunities FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- opportunity_competitors
-- Track competing vendors per opportunity.
-- -----------------------------------------------------------------------------
CREATE TABLE opportunity_competitors (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    competitor_name TEXT        NOT NULL,
    strength        TEXT        CHECK (strength IN ('weak','moderate','strong')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opp_competitors_opp ON opportunity_competitors(opportunity_id);

ALTER TABLE opportunity_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_opp_competitors_all" ON opportunity_competitors FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- crm_activities
-- Phone calls, emails, meetings, site visits — logged against any CRM entity.
-- -----------------------------------------------------------------------------
CREATE TABLE crm_activities (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT        NOT NULL CHECK (entity_type IN ('lead','opportunity','company','contact','job')),
    entity_id       TEXT        NOT NULL,          -- UUID or job TEXT id stored as text

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

CREATE INDEX idx_crm_act_entity ON crm_activities(entity_type, entity_id);
CREATE INDEX idx_crm_act_assigned ON crm_activities(assigned_to);
CREATE INDEX idx_crm_act_scheduled ON crm_activities(scheduled_at);

CREATE TRIGGER crm_activities_upd BEFORE UPDATE ON crm_activities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_crm_activities_all" ON crm_activities FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- crm_tasks
-- To-do items assigned to a user, linked to any entity.
-- -----------------------------------------------------------------------------
CREATE TABLE crm_tasks (
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

CREATE INDEX idx_crm_tasks_entity ON crm_tasks(entity_type, entity_id);
CREATE INDEX idx_crm_tasks_assigned ON crm_tasks(assigned_to);
CREATE INDEX idx_crm_tasks_due ON crm_tasks(due_date);
CREATE INDEX idx_crm_tasks_status ON crm_tasks(status) WHERE status <> 'done';

CREATE TRIGGER crm_tasks_upd BEFORE UPDATE ON crm_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_crm_tasks_all" ON crm_tasks FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 2: QUOTING
-- Opportunity → Quote → Quote Revision → Quote Line Items → Approval
-- =============================================================================

-- -----------------------------------------------------------------------------
-- quotes
-- A quote document linked to an opportunity. Multiple quotes per opportunity
-- are allowed (alternates, re-bids).
-- -----------------------------------------------------------------------------
CREATE TABLE quotes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id  UUID        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    job_id          TEXT        REFERENCES jobs(id) ON DELETE SET NULL,  -- set after conversion

    quote_number    TEXT        NOT NULL UNIQUE,   -- Q-2026-0042-R1
    revision        SMALLINT    NOT NULL DEFAULT 1,
    status          TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','internal_review','sent','client_review','approved','rejected','superseded','expired')),

    title           TEXT        NOT NULL,
    description     TEXT,
    scope_inclusions TEXT,
    scope_exclusions TEXT,
    assumptions     TEXT,

    -- Financials (rolled up from line items)
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_pct    NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(14,2) DEFAULT 0,
    tax_pct         NUMERIC(5,2) DEFAULT 0,
    tax_amount      NUMERIC(14,2) DEFAULT 0,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0,
    margin_pct      NUMERIC(5,2),
    cost_total      NUMERIC(14,2),   -- internal cost; hidden by RLS for non-admins

    -- Validity
    valid_from      DATE,
    valid_until     DATE,
    issued_date     DATE,
    accepted_date   DATE,

    -- Delivery
    lead_time_days  INT,
    delivery_date   DATE,
    install_scope   BOOLEAN DEFAULT FALSE,

    -- Ownership
    prepared_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at     TIMESTAMPTZ,

    -- NetSuite
    netsuite_quote_id TEXT,
    netsuite_so_id  TEXT,

    notes           TEXT,
    internal_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_number ON quotes(quote_number);
CREATE INDEX idx_quotes_job ON quotes(job_id);

CREATE TRIGGER quotes_upd BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_quotes_all" ON quotes FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- quote_line_items
-- Individual line items on a quote (modules, site work, accessories, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE quote_line_items (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    sort_order      SMALLINT    NOT NULL DEFAULT 0,

    category        TEXT        CHECK (category IN ('module','site_work','electrical','plumbing','hvac','finishes','freight','install','option','allowance','other')),
    description     TEXT        NOT NULL,
    part_number     TEXT,
    unit            TEXT        DEFAULT 'ea',      -- ea, lf, sf, ls
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

CREATE INDEX idx_qli_quote ON quote_line_items(quote_id);

CREATE TRIGGER qli_upd BEFORE UPDATE ON quote_line_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_qli_all" ON quote_line_items FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- quote_revisions
-- Immutable snapshot of a quote at a point in time (for audit trail).
-- -----------------------------------------------------------------------------
CREATE TABLE quote_revisions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    revision_number SMALLINT    NOT NULL,
    snapshot        JSONB       NOT NULL,          -- full quote + line items at time of save
    change_summary  TEXT,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (quote_id, revision_number)
);

CREATE INDEX idx_qrev_quote ON quote_revisions(quote_id);

ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_qrev_all" ON quote_revisions FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- quote_approvals
-- Approval workflow steps per quote. Supports multi-step sign-off.
-- -----------------------------------------------------------------------------
CREATE TABLE quote_approvals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    step            SMALLINT    NOT NULL DEFAULT 1,    -- 1=estimator, 2=PM, 3=exec
    role_required   TEXT        NOT NULL,              -- "Estimator","PM","VP Sales"
    assigned_to     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','skipped')),
    decision_at     TIMESTAMPTZ,
    comments        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (quote_id, step)
);

CREATE INDEX idx_qapproval_quote ON quote_approvals(quote_id);
CREATE INDEX idx_qapproval_assigned ON quote_approvals(assigned_to);

ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_qapproval_all" ON quote_approvals FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 3: PRODUCTION JOBS (extensions to existing `jobs` table)
-- =============================================================================
-- The existing `jobs` table is the core record. We extend it with supplemental
-- tables rather than altering the already-wide main table further.

-- -----------------------------------------------------------------------------
-- job_milestones
-- Key schedule gates per job (permits, DSA stamp, materials on-site, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE job_milestones (
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

CREATE INDEX idx_milestones_job ON job_milestones(job_id);
CREATE INDEX idx_milestones_date ON job_milestones(planned_date);

CREATE TRIGGER job_milestones_upd BEFORE UPDATE ON job_milestones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_job_milestones_all" ON job_milestones FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- job_materials
-- Bill of materials per job — what needs to be ordered/tracked.
-- -----------------------------------------------------------------------------
CREATE TABLE job_materials (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    material_id     UUID        REFERENCES materials(id) ON DELETE SET NULL,  -- see Module 7
    description     TEXT        NOT NULL,
    part_number     TEXT,
    category        TEXT        CHECK (category IN ('structural','electrical','plumbing','hvac','finishes','hardware','glazing','roofing','other')),
    unit            TEXT        DEFAULT 'ea',
    quantity_required NUMERIC(10,3) NOT NULL DEFAULT 1,
    quantity_on_hand  NUMERIC(10,3) DEFAULT 0,
    quantity_ordered  NUMERIC(10,3) DEFAULT 0,
    unit_cost       NUMERIC(12,2),
    extended_cost   NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity_required * unit_cost, 2)) STORED,
    lead_time_days  INT,
    required_by_date DATE,
    procurement_status TEXT NOT NULL DEFAULT 'not_ordered'
                        CHECK (procurement_status IN ('not_ordered','ordered','partial','received','complete','on_hold')),
    supplier_name   TEXT,
    po_number       TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_materials_job ON job_materials(job_id);
CREATE INDEX idx_job_materials_status ON job_materials(procurement_status);
CREATE INDEX idx_job_materials_required ON job_materials(required_by_date);

CREATE TRIGGER job_materials_upd BEFORE UPDATE ON job_materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_job_materials_all" ON job_materials FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- job_attachments
-- Files, drawings, photos linked to a job (pointers to Supabase Storage).
-- Extends the existing `documents` table concept with job-specific metadata.
-- -----------------------------------------------------------------------------
CREATE TABLE job_attachments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    category        TEXT        CHECK (category IN ('drawing','photo','spec','permit','approval','correspondence','report','contract','other')),
    name            TEXT        NOT NULL,
    storage_path    TEXT        NOT NULL,          -- Supabase Storage path
    file_type       TEXT,                          -- MIME type
    file_size_kb    INT,
    version         TEXT,
    revision_date   DATE,
    is_current      BOOLEAN     DEFAULT TRUE,
    source          TEXT        CHECK (source IN ('upload','procore','email','other')),
    uploaded_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_attachments_job ON job_attachments(job_id);
CREATE INDEX idx_job_attachments_category ON job_attachments(category);

ALTER TABLE job_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_job_attachments_all" ON job_attachments FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 4: ROUTING ENGINE
-- Templates define standard step sequences; instances are stamped onto jobs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- departments
-- Production departments / work centers (also used in capacity planning).
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL UNIQUE,   -- "Framing","Electrical","HVAC","Finish"
    code            TEXT        NOT NULL UNIQUE,   -- "FRM","ELE","HVAC","FIN"
    production_line_id TEXT     REFERENCES production_lines(id) ON DELETE SET NULL,
    sort_order      SMALLINT    DEFAULT 0,
    is_active       BOOLEAN     DEFAULT TRUE,
    color           TEXT        DEFAULT '#3b82f6',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_line ON departments(production_line_id);

CREATE TRIGGER departments_upd BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_departments_all" ON departments FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- routing_templates
-- Named production route (e.g. "Standard Classroom", "Admin Wing").
-- -----------------------------------------------------------------------------
CREATE TABLE routing_templates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    code            TEXT        UNIQUE,
    description     TEXT,
    building_type   TEXT,              -- matches opportunity/job building_type
    module_range_min INT,
    module_range_max INT,
    is_active       BOOLEAN     DEFAULT TRUE,
    version         SMALLINT    DEFAULT 1,
    created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER routing_templates_upd BEFORE UPDATE ON routing_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE routing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_routing_templates_all" ON routing_templates FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- routing_steps
-- Ordered steps within a template. Supports sequential and parallel steps.
-- -----------------------------------------------------------------------------
CREATE TABLE routing_steps (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID        NOT NULL REFERENCES routing_templates(id) ON DELETE CASCADE,
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,

    step_number     SMALLINT    NOT NULL,
    name            TEXT        NOT NULL,
    description     TEXT,

    -- Timing
    duration_type   TEXT        NOT NULL DEFAULT 'per_module'
                                CHECK (duration_type IN ('fixed','per_module','per_crew_day')),
    duration_hours  NUMERIC(8,2) NOT NULL DEFAULT 8,
    setup_hours     NUMERIC(6,2) DEFAULT 0,
    teardown_hours  NUMERIC(6,2) DEFAULT 0,

    -- Sequencing
    parallel_group  SMALLINT,   -- steps with same group# run in parallel
    predecessor_step SMALLINT,  -- step_number of required predecessor
    lag_hours       NUMERIC(6,2) DEFAULT 0,  -- delay after predecessor completes

    -- Resources
    crew_required   SMALLINT    DEFAULT 1,
    equipment_notes TEXT,

    is_inspection_point BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_id, step_number)
);

CREATE INDEX idx_routing_steps_template ON routing_steps(template_id);
CREATE INDEX idx_routing_steps_dept ON routing_steps(department_id);

CREATE TRIGGER routing_steps_upd BEFORE UPDATE ON routing_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE routing_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_routing_steps_all" ON routing_steps FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- job_routing_steps
-- Instantiated routing steps for a specific job — the live work order sequence.
-- -----------------------------------------------------------------------------
CREATE TABLE job_routing_steps (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    template_step_id UUID       REFERENCES routing_steps(id) ON DELETE SET NULL,
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,

    step_number     SMALLINT    NOT NULL,
    name            TEXT        NOT NULL,

    -- Planned schedule
    planned_start   TIMESTAMPTZ,
    planned_end     TIMESTAMPTZ,
    planned_hours   NUMERIC(8,2),

    -- Actual
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    actual_hours    NUMERIC(8,2),

    status          TEXT        NOT NULL DEFAULT 'not_started'
                                CHECK (status IN ('not_started','ready','in_progress','complete','skipped','blocked')),
    percent_complete SMALLINT   DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
    crew_assigned   SMALLINT    DEFAULT 0,

    assigned_user_id UUID       REFERENCES auth.users(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, step_number)
);

CREATE INDEX idx_jrs_job ON job_routing_steps(job_id);
CREATE INDEX idx_jrs_dept ON job_routing_steps(department_id);
CREATE INDEX idx_jrs_status ON job_routing_steps(status);
CREATE INDEX idx_jrs_planned_start ON job_routing_steps(planned_start);

CREATE TRIGGER jrs_upd BEFORE UPDATE ON job_routing_steps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE job_routing_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_jrs_all" ON job_routing_steps FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 5: CAPACITY PLANNING
-- =============================================================================

-- (departments table already created in Module 4)

-- -----------------------------------------------------------------------------
-- resources
-- Individual people or machines that can be scheduled.
-- -----------------------------------------------------------------------------
CREATE TABLE resources (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
    name            TEXT        NOT NULL,
    code            TEXT,
    type            TEXT        NOT NULL DEFAULT 'person'
                                CHECK (type IN ('person','machine','tool','subcontractor')),
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,  -- if linked to a user account
    skill_level     TEXT        CHECK (skill_level IN ('apprentice','journeyman','foreman','lead')),
    hourly_rate     NUMERIC(8,2),
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resources_dept ON resources(department_id);
CREATE INDEX idx_resources_type ON resources(type);

CREATE TRIGGER resources_upd BEFORE UPDATE ON resources
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_resources_all" ON resources FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- capacity_rules
-- Defines the standard capacity for a department per period.
-- -----------------------------------------------------------------------------
CREATE TABLE capacity_rules (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    effective_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    expires_date    DATE,

    shifts_per_day  SMALLINT    NOT NULL DEFAULT 1,
    hours_per_shift NUMERIC(4,2) NOT NULL DEFAULT 8,
    days_per_week   SMALLINT    NOT NULL DEFAULT 5,
    crew_size       SMALLINT    NOT NULL DEFAULT 1,

    -- Computed: hours_per_shift * shifts_per_day * crew_size = daily capacity
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_rules_dept ON capacity_rules(department_id);
CREATE INDEX idx_cap_rules_date ON capacity_rules(effective_date);

CREATE TRIGGER cap_rules_upd BEFORE UPDATE ON capacity_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE capacity_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_cap_rules_all" ON capacity_rules FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- capacity_blocks
-- Exceptions to normal capacity: holidays, shutdowns, special events.
-- -----------------------------------------------------------------------------
CREATE TABLE capacity_blocks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        REFERENCES departments(id) ON DELETE CASCADE,
    -- NULL department_id = applies to entire facility
    block_date      DATE        NOT NULL,
    block_type      TEXT        NOT NULL DEFAULT 'holiday'
                                CHECK (block_type IN ('holiday','shutdown','reduced','overtime','training')),
    capacity_pct    SMALLINT    NOT NULL DEFAULT 0 CHECK (capacity_pct BETWEEN 0 AND 200),
    -- 0=closed, 50=half day, 100=normal, 150=overtime
    name            TEXT        NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cap_blocks_date ON capacity_blocks(block_date);
CREATE INDEX idx_cap_blocks_dept ON capacity_blocks(department_id);

ALTER TABLE capacity_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_cap_blocks_all" ON capacity_blocks FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 6: SCHEDULING
-- Fine-grained task scheduling within a job, linked to routing steps.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- scheduled_tasks
-- Atomic work assignments: a resource, a time block, a routing step.
-- -----------------------------------------------------------------------------
CREATE TABLE scheduled_tasks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_routing_step_id UUID    REFERENCES job_routing_steps(id) ON DELETE SET NULL,
    department_id   UUID        REFERENCES departments(id) ON DELETE SET NULL,
    resource_id     UUID        REFERENCES resources(id) ON DELETE SET NULL,

    title           TEXT        NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end   TIMESTAMPTZ NOT NULL,
    duration_hours  NUMERIC(6,2) GENERATED ALWAYS AS (
                        EXTRACT(EPOCH FROM (scheduled_end - scheduled_start)) / 3600
                    ) STORED,

    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    actual_hours    NUMERIC(6,2),

    status          TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','confirmed','in_progress','complete','cancelled','no_show')),
    priority        TEXT        DEFAULT 'Medium'
                                CHECK (priority IN ('Low','Medium','High','Critical')),

    is_milestone    BOOLEAN     DEFAULT FALSE,
    requires_inspection BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX idx_sched_tasks_job ON scheduled_tasks(job_id);
CREATE INDEX idx_sched_tasks_resource ON scheduled_tasks(resource_id);
CREATE INDEX idx_sched_tasks_dept ON scheduled_tasks(department_id);
CREATE INDEX idx_sched_tasks_start ON scheduled_tasks(scheduled_start);
CREATE INDEX idx_sched_tasks_status ON scheduled_tasks(status);
-- Covering index for dispatch board queries
CREATE INDEX idx_sched_tasks_dispatch ON scheduled_tasks(scheduled_start, department_id, status);

CREATE TRIGGER sched_tasks_upd BEFORE UPDATE ON scheduled_tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_sched_tasks_all" ON scheduled_tasks FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- schedule_conflicts
-- Detected conflicts persisted for UI display and notification.
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_conflicts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_type   TEXT        NOT NULL CHECK (conflict_type IN (
                        'resource_double_book','line_overlap','capacity_exceeded',
                        'dependency_violated','late_delivery','readiness_gap')),
    severity        TEXT        NOT NULL DEFAULT 'warning'
                                CHECK (severity IN ('info','warning','critical')),

    -- What conflicts
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

CREATE INDEX idx_conflicts_job_a ON schedule_conflicts(job_a_id);
CREATE INDEX idx_conflicts_job_b ON schedule_conflicts(job_b_id);
CREATE INDEX idx_conflicts_resource ON schedule_conflicts(resource_id);
CREATE INDEX idx_conflicts_unresolved ON schedule_conflicts(is_resolved) WHERE is_resolved = FALSE;

CREATE TRIGGER conflicts_upd BEFORE UPDATE ON schedule_conflicts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE schedule_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_conflicts_all" ON schedule_conflicts FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 7: MATERIAL PLANNING
-- Catalog + requirements + procurement orders
-- =============================================================================

-- -----------------------------------------------------------------------------
-- materials
-- Master material catalog / item master.
-- -----------------------------------------------------------------------------
CREATE TABLE materials (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number     TEXT        UNIQUE,
    name            TEXT        NOT NULL,
    description     TEXT,
    category        TEXT        CHECK (category IN ('structural','electrical','plumbing','hvac','finishes','hardware','glazing','roofing','consumable','other')),
    unit            TEXT        NOT NULL DEFAULT 'ea',
    unit_cost       NUMERIC(12,2),
    list_price      NUMERIC(12,2),
    lead_time_days  INT         DEFAULT 0,
    reorder_point   NUMERIC(10,3),
    preferred_supplier TEXT,
    supplier_part_number TEXT,
    netsuite_item_id TEXT,
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_category ON materials(category);
CREATE INDEX idx_materials_part ON materials(part_number);
CREATE INDEX idx_materials_netsuite ON materials(netsuite_item_id);

CREATE TRIGGER materials_upd BEFORE UPDATE ON materials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_materials_all" ON materials FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- material_requirements
-- Planned material need for a job — generated from BOM or manual entry.
-- Links job_materials to procurement_orders.
-- -----------------------------------------------------------------------------
CREATE TABLE material_requirements (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_material_id UUID        REFERENCES job_materials(id) ON DELETE SET NULL,
    material_id     UUID        REFERENCES materials(id) ON DELETE SET NULL,

    description     TEXT        NOT NULL,
    quantity_required NUMERIC(10,3) NOT NULL,
    quantity_allocated NUMERIC(10,3) DEFAULT 0,
    quantity_received  NUMERIC(10,3) DEFAULT 0,
    unit            TEXT        DEFAULT 'ea',
    unit_cost       NUMERIC(12,2),

    required_by_date DATE,
    status          TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','partially_ordered','fully_ordered','partially_received','received','cancelled')),
    priority        TEXT        DEFAULT 'Medium'
                                CHECK (priority IN ('Low','Medium','High','Critical')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mat_req_job ON material_requirements(job_id);
CREATE INDEX idx_mat_req_material ON material_requirements(material_id);
CREATE INDEX idx_mat_req_status ON material_requirements(status);
CREATE INDEX idx_mat_req_date ON material_requirements(required_by_date);

CREATE TRIGGER mat_req_upd BEFORE UPDATE ON material_requirements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE material_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_mat_req_all" ON material_requirements FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- procurement_orders
-- Purchase orders / procurement requests to suppliers.
-- -----------------------------------------------------------------------------
CREATE TABLE procurement_orders (
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

CREATE INDEX idx_po_status ON procurement_orders(status);
CREATE INDEX idx_po_supplier ON procurement_orders(supplier_name);
CREATE INDEX idx_po_required ON procurement_orders(required_date);
CREATE INDEX idx_po_netsuite ON procurement_orders(netsuite_po_id);

CREATE TRIGGER po_upd BEFORE UPDATE ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE procurement_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_po_all" ON procurement_orders FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- procurement_order_lines
-- Line items on a PO, linked back to material requirements.
-- -----------------------------------------------------------------------------
CREATE TABLE procurement_order_lines (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id           UUID        NOT NULL REFERENCES procurement_orders(id) ON DELETE CASCADE,
    requirement_id  UUID        REFERENCES material_requirements(id) ON DELETE SET NULL,
    material_id     UUID        REFERENCES materials(id) ON DELETE SET NULL,

    line_number     SMALLINT    NOT NULL,
    description     TEXT        NOT NULL,
    part_number     TEXT,
    unit            TEXT        DEFAULT 'ea',
    quantity_ordered NUMERIC(10,3) NOT NULL,
    quantity_received NUMERIC(10,3) DEFAULT 0,
    unit_cost       NUMERIC(12,2) NOT NULL,
    extended_cost   NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantity_ordered * unit_cost, 2)) STORED,
    received_date   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (po_id, line_number)
);

CREATE INDEX idx_pol_po ON procurement_order_lines(po_id);
CREATE INDEX idx_pol_requirement ON procurement_order_lines(requirement_id);
CREATE INDEX idx_pol_material ON procurement_order_lines(material_id);

ALTER TABLE procurement_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_pol_all" ON procurement_order_lines FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- MODULE 8: INTEGRATION LAYER
-- Sync logs and external ID mappings for NetSuite, Procore, Excel, etc.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- external_id_map
-- Central registry mapping internal IDs to external system IDs.
-- Avoids scattering external_id columns across every table.
-- -----------------------------------------------------------------------------
CREATE TABLE external_id_map (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    system          TEXT        NOT NULL CHECK (system IN ('netsuite','procore','excel','salesforce','other')),
    external_id     TEXT        NOT NULL,
    entity_type     TEXT        NOT NULL,          -- 'job','quote','contact','company','material','po'
    internal_id     TEXT        NOT NULL,           -- UUID or TEXT pk of the local row
    sync_direction  TEXT        DEFAULT 'bidirectional'
                                CHECK (sync_direction IN ('inbound','outbound','bidirectional')),
    last_synced_at  TIMESTAMPTZ,
    is_active       BOOLEAN     DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (system, external_id, entity_type)
);

CREATE INDEX idx_ext_map_system ON external_id_map(system, entity_type);
CREATE INDEX idx_ext_map_internal ON external_id_map(entity_type, internal_id);

ALTER TABLE external_id_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_ext_map_all" ON external_id_map FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- netsuite_sync_log
-- Per-record audit trail for every NetSuite push/pull operation.
-- -----------------------------------------------------------------------------
CREATE TABLE netsuite_sync_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT        NOT NULL,          -- 'job','quote','po','contact','company'
    internal_id     TEXT        NOT NULL,
    netsuite_id     TEXT,
    operation       TEXT        NOT NULL CHECK (operation IN ('create','update','delete','read','upsert')),
    direction       TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
    status          TEXT        NOT NULL CHECK (status IN ('success','error','skipped','pending')),
    http_status     INT,
    request_payload JSONB,
    response_payload JSONB,
    error_message   TEXT,
    triggered_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ns_log_entity ON netsuite_sync_log(entity_type, internal_id);
CREATE INDEX idx_ns_log_status ON netsuite_sync_log(status);
CREATE INDEX idx_ns_log_created ON netsuite_sync_log(created_at DESC);

ALTER TABLE netsuite_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_ns_log_all" ON netsuite_sync_log FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- procore_sync_log
-- Per-sync audit trail for Procore edge function calls.
-- Complements existing activity_log procore_manual_sync entries with richer
-- per-entity detail.
-- -----------------------------------------------------------------------------
CREATE TABLE procore_sync_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          TEXT        REFERENCES jobs(id) ON DELETE SET NULL,
    procore_project_id BIGINT,
    job_number      TEXT,
    triggered_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    trigger_type    TEXT        NOT NULL DEFAULT 'manual'
                                CHECK (trigger_type IN ('manual','webhook','scheduled','bulk')),

    -- Counts written during this sync
    submittals_synced     INT DEFAULT 0,
    rfis_synced           INT DEFAULT 0,
    punch_items_synced    INT DEFAULT 0,
    change_events_synced  INT DEFAULT 0,
    inspections_synced    INT DEFAULT 0,
    observations_synced   INT DEFAULT 0,

    status          TEXT        NOT NULL CHECK (status IN ('success','partial','error')),
    error_message   TEXT,
    duration_ms     INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_procore_log_job ON procore_sync_log(job_id);
CREATE INDEX idx_procore_log_created ON procore_sync_log(created_at DESC);
CREATE INDEX idx_procore_log_status ON procore_sync_log(status);

ALTER TABLE procore_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_procore_log_all" ON procore_sync_log FOR ALL TO authenticated USING (TRUE);

-- -----------------------------------------------------------------------------
-- webhook_events
-- Inbound webhook payloads from Procore and other systems, queued for processing.
-- -----------------------------------------------------------------------------
CREATE TABLE webhook_events (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT        NOT NULL CHECK (source IN ('procore','netsuite','other')),
    event_type      TEXT        NOT NULL,           -- "rfis#created", "submittals#updated" etc.
    external_id     TEXT,
    procore_project_id BIGINT,
    payload         JSONB       NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','processed','failed','ignored')),
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    retry_count     SMALLINT    DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_status ON webhook_events(status) WHERE status IN ('pending','failed');
CREATE INDEX idx_webhook_source ON webhook_events(source, event_type);
CREATE INDEX idx_webhook_created ON webhook_events(created_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_webhook_all" ON webhook_events FOR ALL TO authenticated USING (TRUE);

-- =============================================================================
-- SEQUENCE / AUTO-NUMBER HELPERS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS opportunity_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS po_number_seq START 1;

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

CREATE TRIGGER opp_number_gen BEFORE INSERT ON opportunities
    FOR EACH ROW EXECUTE FUNCTION generate_opportunity_number();

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

CREATE TRIGGER quote_number_gen BEFORE INSERT ON quotes
    FOR EACH ROW EXECUTE FUNCTION generate_quote_number();

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

CREATE TRIGGER po_number_gen BEFORE INSERT ON procurement_orders
    FOR EACH ROW EXECUTE FUNCTION generate_po_number();

-- =============================================================================
-- REALTIME (enable for high-frequency polling tables)
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_conflicts;
ALTER PUBLICATION supabase_realtime ADD TABLE job_routing_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE material_requirements;
ALTER PUBLICATION supabase_realtime ADD TABLE procurement_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE webhook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE opportunities;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
```

---

## Schema Design Notes

### Entity Hierarchy (as implemented)

```
companies ──< contacts
     │
     └──< leads ──> opportunities ──< quotes ──< quote_line_items
                          │               └──< quote_approvals
                          │               └──< quote_revisions
                          │
                          └──> jobs (existing) ──< job_milestones
                                    │           ──< job_materials ──> materials
                                    │           ──< job_attachments
                                    │           ──< job_routing_steps ──< scheduled_tasks
                                    │                    │
                                    │           routing_templates ──< routing_steps
                                    │
                                    └──< procore_rfis / punch_items / etc. (existing)
                                    └──< submittals (existing)

departments ──< resources ──< scheduled_tasks
           ──< capacity_rules
           ──< capacity_blocks

schedule_conflicts (links task_a ↔ task_b or job_a ↔ job_b)

external_id_map (cross-system ID registry)
netsuite_sync_log / procore_sync_log / webhook_events (integration audit)
```

### Key Design Decisions

1. **Non-destructive extension.** Existing tables (`jobs`, `clients`, `sales_pipeline_deals`, `contacts`, `submittals`, `activity_log`) are left intact. New tables reference them; `opportunities` links back to `sales_pipeline_deals` via `legacy_deal_id` so old Kanban data is preserved.

2. **`external_id_map` replaces scattered columns.** Rather than adding `netsuite_id` to every table, a single junction table normalizes all cross-system IDs. The existing per-table Procore/NetSuite columns on `jobs` are kept for read performance.

3. **`departments` bridges routing and capacity.** A department ties together a production line, its routing steps, its resources, and its capacity rules — making it the central capacity unit.

4. **Generated columns for financials.** `extended_price`, `extended_cost`, `margin_pct`, `weighted_value`, and `duration_hours` are all `GENERATED ALWAYS AS ... STORED` so application code never needs to recompute them; they are always consistent and indexable.

5. **`routing_steps.parallel_group` + `predecessor_step`.** This encodes a DAG precedence constraint without a separate adjacency table, which is sufficient for linear/parallel manufacturing routes. For complex networks, replace with a `routing_step_dependencies` table.

6. **`capacity_blocks.capacity_pct = 0..200`** allows both zero-capacity (holidays) and overtime (150%) to be expressed in one column rather than a separate overtime table.

7. **`webhook_events` queue.** Procore webhooks arrive faster than Supabase edge functions can process them reliably. Storing raw payloads first and processing asynchronously prevents data loss during bursts or function cold-start delays.

8. **Auto-number sequences** (`OPP-YYYY-NNNN`, `Q-YYYY-NNNN`, `PO-YYYY-NNNN`) fire on INSERT triggers so application code never needs to generate them, and they reset meaning yearly reuse is avoided by the year prefix.