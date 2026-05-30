# Manufacturing CRM-to-Production OS — Implementation Plan

## Pre-Flight Checklist (Decisions Required Before Starting)

Before any phase begins, the following decisions need user input:

- [ ] **NetSuite credentials**: Account ID, Token Key, Token Secret, Consumer Key, Consumer Secret — needed for Phase 11
- [ ] **AI provider**: Claude API key (Anthropic) for the intake edge function — needed for Phase 13
- [ ] **Procore app credentials**: Confirm existing `PROCORE_CLIENT_ID` / `PROCORE_CLIENT_SECRET` in Supabase secrets are current — needed for Phase 12
- [ ] **Supabase project**: Confirm project ID `ixbffxowwvpzzuamvgix` is the target for all migrations
- [ ] **Opportunity number sequence start**: Should `OPP-` numbering start at 1, or seed from existing `sales_pipeline_deals` count?
- [ ] **Legacy data migration**: Should existing `sales_pipeline_deals` rows be backfilled into `opportunities`? (Affects Phase 2)
- [ ] **User roles**: What roles exist beyond `authenticated`? (e.g. `admin`, `estimator`, `pm`, `sales`) — affects `usePermission` hook in Phase 1
- [ ] **Routing first vs. CRM first**: The plan follows the spec order (CRM → Quoting → ...) but if the production team needs routing/capacity sooner, Phases 6-8 can move earlier without breaking anything

---

## Phase 1: Foundation

**Complexity: L**
**Depends on: nothing**

### What gets built
App shell, routing, auth store, shared component library, API base layer, and the complete database migration. All subsequent phases build on top of this.

### Database Migrations

Run as a single migration file: `supabase/migration_v2.sql` (already exists as untracked file — review and apply it).

Tables created (in dependency order):
- `companies`
- Alter `contacts` (add `company_id`, `first_name`, `last_name`, `mobile`, `department`, `linkedin`, `is_primary`, `do_not_contact`, `owner_user_id`)
- `leads`
- `opportunities`
- `opportunity_competitors`
- `crm_activities`
- `crm_tasks`
- `quotes`
- `quote_line_items`
- `quote_revisions`
- `quote_approvals`
- `departments`
- `routing_templates`
- `routing_steps`
- `job_routing_steps`
- `resources`
- `capacity_rules`
- `capacity_blocks`
- `scheduled_tasks`
- `schedule_conflicts`
- `materials`
- `job_milestones`
- `job_materials`
- `job_attachments`
- `material_requirements`
- `procurement_orders`
- `procurement_order_lines`
- `external_id_map`
- `netsuite_sync_log`
- `procore_sync_log`
- `webhook_events`
- `intake_drafts` (not in main schema — add to migration)
- Sequences: `opportunity_number_seq`, `quote_number_seq`, `po_number_seq`
- Triggers: `set_updated_at`, all `*_upd` triggers, `opp_number_gen`, `quote_number_gen`, `po_number_gen`
- Realtime publications for 8 tables

**Migration decision required**: The existing `supabase/migration_v2.sql` file needs review before applying — it may be partial. Compare against the full schema above.

### Files to Create

```
src/app/App.jsx
src/app/AppShell.jsx
src/app/routes.jsx
src/app/queryClient.js

src/store/authStore.js
src/store/appStore.js
src/store/realtimeStore.js

src/lib/supabase.js          ← move/refactor from wherever supabase client currently lives
src/lib/apiBase.js

src/hooks/useRealtime.js
src/hooks/useDebounce.js
src/hooks/usePagination.js
src/hooks/usePermission.js

src/components/ui/Button.jsx
src/components/ui/Modal.jsx
src/components/ui/SlideOver.jsx
src/components/ui/DataTable.jsx
src/components/ui/KanbanBoard.jsx
src/components/ui/FormField.jsx
src/components/ui/Select.jsx
src/components/ui/DatePicker.jsx
src/components/ui/CurrencyInput.jsx
src/components/ui/ProgressBar.jsx
src/components/ui/Tabs.jsx
src/components/ui/EmptyState.jsx
src/components/ui/ConfirmDialog.jsx
src/components/ui/SearchInput.jsx
src/components/ui/Badge.jsx
src/components/ui/ActivityFeed.jsx
src/components/ui/MetricCard.jsx
src/components/ui/StatusChip.jsx
src/components/ui/SectionHeader.jsx
src/components/ui/Timeline.jsx    ← re-export wrapper

src/utils/dates.js
src/utils/formatters.js
src/utils/constants.js
```

### Files to Modify

- `src/components/ProductionScheduler.jsx` — **no logic changes**; wrap in `<AppShell>` at the route level, not inside the component. The component's internal `activeModule` state continues to drive its own nav. The only change: ensure the existing Supabase client import path resolves to `src/lib/supabase.js`.
- `src/hooks/usePipelineDeals.js` — **no logic changes**; update import path for supabase client if it moves
- `src/lib/pipelineApi.js` — **no logic changes**; update import path for supabase client
- `src/index.css` — **no changes yet**; new module CSS classes will be appended in later phases
- `package.json` — add: `react-router-dom@6`, `@tanstack/react-query@5`, `zustand@4`

### Breaking Change Warning

> **NONE in this phase.** The existing `ProductionScheduler` is mounted at `/production/scheduler` exactly as-is. The `AppShell` wraps it as a child route, not a replacement. The internal `activeModule` state in `ProductionScheduler` is untouched — it continues to drive its own internal tab switching. The new URL-based routing only controls which top-level module is visible.

### What You Can Demo After Phase 1

- App loads, user can log in via existing Supabase auth
- Navigation shell renders with placeholder panels for each module
- Existing Production Scheduler accessible at `/production/scheduler` and fully functional (no regression)
- All new database tables exist in Supabase (verify in Studio)
- Shared UI components visible in a simple `/dev/components` route (optional storybook-style page)

---

## Phase 2: CRM Module

**Complexity: XL**
**Depends on: Phase 1**

### Database Migrations

None — all tables created in Phase 1. If backfilling `sales_pipeline_deals` into `opportunities`:

```sql
-- Optional backfill (user decision required)
INSERT INTO opportunities (legacy_deal_id, name, stage, probability, contract_value,
  bdm_name, estimator_name, pm_name, expected_occupancy_date, source_type, source_sheet, source_row)
SELECT id, opportunity_name, stage, probability, amount,
  bdm, estimator, project_manager, expected_close_date, source_type, source_sheet, source_row
FROM sales_pipeline_deals;
```

### Files to Create

```
src/lib/crmApi.js

src/modules/crm/CrmModule.jsx
src/modules/crm/CrmDashboard.jsx

src/modules/crm/companies/CompanyList.jsx
src/modules/crm/companies/CompanyDetail.jsx
src/modules/crm/companies/CompanyForm.jsx

src/modules/crm/contacts/ContactList.jsx
src/modules/crm/contacts/ContactDetail.jsx
src/modules/crm/contacts/ContactForm.jsx

src/modules/crm/leads/LeadList.jsx
src/modules/crm/leads/LeadDetail.jsx
src/modules/crm/leads/LeadForm.jsx

src/modules/crm/opportunities/OpportunityList.jsx    ← absorbs PipelineKanban logic
src/modules/crm/opportunities/OpportunityDetail.jsx
src/modules/crm/opportunities/OpportunityForm.jsx

src/modules/crm/activities/ActivityList.jsx
src/modules/crm/activities/ActivityForm.jsx

src/modules/crm/hooks/useCompanies.js
src/modules/crm/hooks/useOpportunities.js
src/modules/crm/hooks/useLeads.js
src/modules/crm/hooks/useCrmActivities.js
src/modules/crm/hooks/useCrmTasks.js
```

### Files to Modify

- `src/app/routes.jsx` — register all `/crm/*` routes
- `src/app/AppShell.jsx` — add CRM to sidebar nav
- `src/index.css` — append CRM-specific styles (company/contact/lead card layouts, activity feed)
- `src/components/PipelineKanban.jsx` — **migration decision**: the existing Kanban reads from `usePipelineDeals` (pointing at `sales_pipeline_deals`). Two options:
  - **Option A (recommended)**: Keep `PipelineKanban.jsx` untouched as the legacy view inside `ProductionScheduler`; build `OpportunityList.jsx` as a separate new component reading from `opportunities`. Both coexist.
  - **Option B**: Refactor `PipelineKanban.jsx` to accept a data source prop. More work, single component.

> **User input needed**: Option A or B above?

### Breaking Change Warning

> **LOW RISK.** The existing `PipelineKanban` inside `ProductionScheduler` continues reading from `usePipelineDeals` / `sales_pipeline_deals`. The new `OpportunityList` reads from `opportunities`. They are independent. No data is deleted. The only risk: if a user enters a deal in the old Kanban, it goes to `sales_pipeline_deals` but not `opportunities`. After the backfill and once the team adopts the new CRM, the old Kanban tab in `ProductionScheduler` can be hidden (one-line CSS change, no code deletion).

### What You Can Demo After Phase 2

- Create/edit companies and contacts
- Create leads and qualify/convert them to opportunities
- Opportunity Kanban board (drag cards between stages, weighted value per stage, forecast strip)
- Opportunity detail with 6 tabs: summary, timeline, contacts, quotes placeholder, activities, files placeholder
- Log calls, emails, meetings against any entity
- CRM dashboard: pipeline funnel, stage totals, activity summary

---

## Phase 3: Quoting Module

**Complexity: L**
**Depends on: Phase 2 (needs `opportunities` table and `OpportunityDetail` for "New Quote" button)**

### Database Migrations

None — tables created in Phase 1.

### Files to Create

```
src/lib/quotingApi.js

src/modules/quoting/QuoteList.jsx
src/modules/quoting/QuotePDF.jsx

src/modules/quoting/builder/QuoteBuilder.jsx
src/modules/quoting/builder/QuoteHeader.jsx
src/modules/quoting/builder/LineItemGrid.jsx
src/modules/quoting/builder/MarginCalculator.jsx
src/modules/quoting/builder/ScopeEditor.jsx

src/modules/quoting/revisions/QuoteRevisionList.jsx
src/modules/quoting/revisions/QuoteRevisionView.jsx

src/modules/quoting/approvals/ApprovalQueue.jsx
src/modules/quoting/approvals/ApprovalPanel.jsx

src/modules/quoting/hooks/useQuote.js
src/modules/quoting/hooks/useQuoteLineItems.js
src/modules/quoting/hooks/useSaveQuote.js
src/modules/quoting/hooks/useApprovalQueue.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/quoting/*` routes
- `src/app/AppShell.jsx` — add Quoting to nav
- `src/modules/crm/opportunities/OpportunityDetail.jsx` — add "New Quote" button in Quotes tab linking to `/quoting/quotes/new?opportunityId=X`
- `src/index.css` — append quote builder grid styles, line item table, approval badge styles

### Key Implementation Notes

- `LineItemGrid` uses `useReducer` for local state — rows are added/edited in memory and saved on blur or explicit save. No DB call per keystroke.
- `MarginCalculator` is a pure component: `(lineItems) => { subtotal, cost, margin }` — no hooks, no DB calls.
- Auto-save fires 2 seconds after last change via debounced mutation (use `useDebounce` from Phase 1).
- `snapshotRevision()` is called explicitly by the user (or automatically on status change to `sent`/`approved`).
- `CurrencyInput` respects `canViewPrices` from `authStore` — estimators and above see cost columns; sales reps do not.

### What You Can Demo After Phase 3

- Create a quote from an opportunity
- Add/edit/reorder line items with real-time margin calculation
- Save revision snapshots and view diffs
- Submit quote for internal approval; approver can approve/reject with comments
- Print/PDF quote (browser print CSS)
- Quote list with status filters

---

## Phase 4: Opportunity-to-Production Conversion Workflow

**Complexity: M**
**Depends on: Phase 2 (opportunities), Phase 3 (approved quotes), Phase 1 (jobs table exists)**

### Database Migrations

None — all tables exist. One stored procedure is recommended:

```sql
-- Wrap the conversion in a DB function to ensure atomicity
CREATE OR REPLACE FUNCTION convert_opportunity_to_job(
  p_opp_id UUID,
  p_job_data JSONB
) RETURNS TEXT LANGUAGE plpgsql AS $$
-- creates job, updates opportunity, inserts milestones
-- returns new job id
$$;
```

Whether to implement this as an RPC or sequential client calls is a **user decision** (RPC is safer for production data integrity; sequential calls are easier to debug).

### Files to Create

```
src/lib/workflowApi.js

src/modules/workflow/ConversionQueue.jsx
src/modules/workflow/HandoffChecklist.jsx

src/modules/workflow/wizard/ConversionWizard.jsx
src/modules/workflow/wizard/Step1ReviewDeal.jsx
src/modules/workflow/wizard/Step2AssignDetails.jsx
src/modules/workflow/wizard/Step3SetSchedule.jsx
src/modules/workflow/wizard/Step4SelectRouting.jsx   ← read-only until Phase 6
src/modules/workflow/wizard/Step5Confirm.jsx

src/modules/workflow/hooks/useConversionQueue.js
src/modules/workflow/hooks/useConversionWizard.js
src/modules/workflow/hooks/useConvertOpportunity.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/workflow/*` routes
- `src/app/AppShell.jsx` — add Workflow to nav
- `src/modules/crm/opportunities/OpportunityDetail.jsx` — add "Convert to Job" action button visible only when stage is `award` or `handoff` and an approved quote exists
- `src/index.css` — append wizard step indicator styles, conversion checklist styles

### Breaking Change Warning

> **MODERATE RISK.** The `useConvertOpportunity` mutation writes to the existing `jobs` table. The `normalizeJob()` function in `src/utils/normalizeJob.js` must handle both old manually-created jobs and new wizard-converted jobs. Specifically:
> - `jobs.line` must be set to a valid production line id or `'QUEUE'` — the wizard Step 2 must enforce this
> - `jobs.start` and `jobs.end` are required by the Gantt renderer — the wizard must not allow conversion without dates
> - The existing `useJobs()` hook will pick up newly converted jobs automatically via Supabase realtime; no changes to the hook needed

Step 4 (routing selection) will show "No templates available yet" until Phase 6 is complete. This is acceptable — the wizard should allow skipping routing selection and applying it later from the job detail screen.

### What You Can Demo After Phase 4

- Conversion Queue shows all opportunities at award/handoff stage with approved quotes
- 5-step wizard walks through review → assign → schedule → routing (placeholder) → confirm
- "Create Job" creates the job record, updates the opportunity's `converted_job_id`, inserts initial milestones, and navigates to the new job
- New job immediately appears in the existing Production Scheduler Gantt (realtime subscription picks it up)

---

## Phase 5: Production Jobs Module

**Complexity: M**
**Depends on: Phase 1 (jobs table, existing hooks), Phase 4 (conversion populates milestones and routing steps)**

### Database Migrations

None. All tables exist.

### Files to Create

```
src/lib/productionApi.js    ← extends patterns from existing jobsApi.js (do not replace)

src/modules/production/jobs/JobList.jsx
src/modules/production/jobs/JobDetail.jsx
src/modules/production/jobs/JobForm.jsx
src/modules/production/jobs/JobMilestones.jsx
src/modules/production/jobs/JobReadinessPanel.jsx
src/modules/production/jobs/JobRoutingPanel.jsx
src/modules/production/jobs/JobMaterialsPanel.jsx

src/modules/production/hooks/useJob.js
src/modules/production/hooks/useJobMilestones.js
src/modules/production/hooks/useJobRoutingSteps.js
src/modules/production/hooks/useJobMaterials.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/production/jobs`, `/production/jobs/:id`; keep `/production/scheduler` and `/production/dispatch` pointing to existing components
- `src/app/AppShell.jsx` — Production nav gets sub-items: Scheduler (existing), Jobs (new), Dispatch (existing)
- `src/components/ProductionScheduler.jsx` — **minimal change only**: the `factSheetId` → `JobFactSheet` drawer path inside the scheduler now also links to `/production/jobs/:id` via a "Full Page" button in the drawer header. No other changes.
- `src/index.css` — append job list table styles, milestone timeline styles, routing step status badge styles

### Key Implementation Notes

- `JobDetail` is structurally the same as the existing `JobFactSheet` drawer (8 tabs) but rendered as a full route at 100% width. The tab *content* components (DSA, Procore, Financials, Activity, Notes tabs) are extracted from `ProductionScheduler.jsx` into shared components that both `JobDetail` and the drawer import. This is the only significant refactor in this phase.
- `JobRoutingPanel` will show "No routing steps assigned" until Phase 6.
- `JobMaterialsPanel` will show "No materials" until Phase 9.
- Real-time subscription on `job_routing_steps` for a specific job is set up now (even though steps won't exist until Phase 6).

### Breaking Change Warning

> **EXTRACTING TAB CONTENT IS THE RISKIEST PART OF THIS PHASE.** The DSA, Production, Procore Live, Financials, Activity, and Notes tab content is currently inline JSX inside `ProductionScheduler.jsx` (within the `JobFactSheet` component or `ModuleWorkspace`). Extracting these into separate files requires careful copy-paste without behavioral change. Recommended approach:
>
> 1. Extract each tab to a file first (copy, not cut)
> 2. Import it back into `ProductionScheduler.jsx` and verify nothing changed visually
> 3. Then also import it into `JobDetail.jsx`
> 4. Only after step 3 passes review: remove the inline JSX from `ProductionScheduler.jsx`
>
> Never do step 4 and step 3 in the same commit.

### What You Can Demo After Phase 5

- `/production/jobs` table view with status/PM/line filters
- Click any job → full-page `JobDetail` with all 8 tabs working (same data as the drawer, wider layout)
- Add/edit milestones on the Schedule tab
- Readiness checklist with live score
- Procore Live tab continues to work identically to the existing drawer version

---

## Phase 6: Routing Engine

**Complexity: M**
**Depends on: Phase 1 (departments, routing_templates, routing_steps tables), Phase 4 (wizard Step 4 needs templates), Phase 5 (job_routing_steps panel)**

### Database Migrations

Seed data migration recommended (not schema changes):

```sql
-- Seed initial departments to match existing production_lines
INSERT INTO departments (name, code, production_line_id, sort_order) VALUES
  ('Line 1 - Framing',    'L1-FRM',  'L1', 1),
  ('Line 1 - Electrical', 'L1-ELE',  'L1', 2),
  -- ... per existing line IDs from constants.js
```

**User decision needed**: What are the actual department names and production line IDs? These should match the `LINE_IDS` constants already in the app.

### Files to Create

```
src/lib/routingApi.js

src/modules/routing/TemplateList.jsx
src/modules/routing/RoutingPreview.jsx

src/modules/routing/builder/TemplateBuilder.jsx
src/modules/routing/builder/StepList.jsx
src/modules/routing/builder/StepForm.jsx
src/modules/routing/builder/StepDurationCalc.jsx

src/modules/routing/departments/DepartmentManager.jsx

src/modules/routing/hooks/useRoutingTemplates.js
src/modules/routing/hooks/useRoutingTemplate.js
src/modules/routing/hooks/useDepartments.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/routing-engine/*` routes
- `src/app/AppShell.jsx` — add Routing Engine to nav
- `src/modules/workflow/wizard/Step4SelectRouting.jsx` — remove "placeholder" message; wire up to `useRoutingTemplates()`
- `src/modules/production/jobs/JobRoutingPanel.jsx` — remove "no steps" placeholder; render actual `job_routing_steps` statuses
- `src/index.css` — append template builder styles, step list drag handles, parallel group banding

### Key Implementation Notes

- `computeTemplateDuration(template, modules, crewSize)` is a pure JS function in `src/lib/routingApi.js` — it operates on the already-fetched steps array. No async call needed for `StepDurationCalc`.
- The drag-to-reorder in `StepList` uses the browser's native `draggable` API (same pattern as the existing Gantt drag). No new DnD library.
- `RoutingPreview` renders a mini proportional Gantt using the same CSS positioning math as the main Gantt, scaled to fit a 300px container.

### What You Can Demo After Phase 6

- Create routing templates with ordered steps, parallel groups, predecessor constraints
- Assign departments and duration (fixed / per-module / per-crew-day)
- Preview computed duration for a given module count
- Clone a template
- Assign a routing template to a job via the conversion wizard (Step 4) — job gets `job_routing_steps` rows
- Routing step status panel in Job Detail shows live step statuses

---

## Phase 7: Capacity Planning

**Complexity: M**
**Depends on: Phase 6 (departments, job_routing_steps with planned_start/end exist)**

### Database Migrations

Seed `capacity_rules` for each department created in Phase 6:

```sql
INSERT INTO capacity_rules (department_id, shifts_per_day, hours_per_shift, days_per_week, crew_size)
SELECT id, 1, 8, 5, 4   -- default: 1 shift, 8hr, M-F, crew of 4
FROM departments WHERE is_active = TRUE;
```

**User decision needed**: What is the actual default crew size per department? This affects all capacity calculations from day one.

### Files to Create

```
src/lib/capacityApi.js

src/modules/capacity/CapacityHeatmap.jsx
src/modules/capacity/CapacityHeatmapCell.jsx
src/modules/capacity/DepartmentCapacityDetail.jsx
src/modules/capacity/CapacityForecast.jsx

src/modules/capacity/rules/CapacityRuleEditor.jsx

src/modules/capacity/calendar/CapacityCalendar.jsx
src/modules/capacity/calendar/BlockForm.jsx

src/modules/capacity/hooks/useCapacityMatrix.js
src/modules/capacity/hooks/useCapacityRules.js
src/modules/capacity/hooks/useCapacityBlocks.js
src/modules/capacity/hooks/useDepartmentLoad.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/capacity/*` routes
- `src/app/AppShell.jsx` — add Capacity to nav
- `src/index.css` — append heatmap grid styles, capacity cell color scale (green → yellow → red), calendar day block styles

### Key Implementation Notes

- `useCapacityMatrix` runs three parallel React Query fetches (rules, blocks, routing steps) then combines them in `useMemo`. The calculation is pure JS — no DB aggregation. At 20 departments × 26 weeks × 300 jobs, this is ~150k comparisons, well within browser budget.
- The `CapacityHeatmap` color scale: `<70%` = green, `70-90%` = amber, `>90%` = red. Exact thresholds are **user decision** — these are hardcoded in `src/utils/constants.js`.
- `CapacityForecast` shows 13 rolling weeks. Demand includes both confirmed routing steps (solid bars) and pipeline demand (weighted, dashed bars) from `opportunities` with `expected_start_date` in range.

### What You Can Demo After Phase 7

- 13-week capacity heatmap across all departments
- Click any cell to see which jobs are loading that department that week
- Edit capacity rules (crew size, shifts, hours) and watch heatmap update
- Add holidays/shutdowns to the calendar
- Department detail: bar chart of load vs. capacity over time
- Forecast overlay: pipeline demand projected onto capacity

---

## Phase 8: Auto Scheduling Engine

**Complexity: XL**
**Depends on: Phase 6 (routing steps), Phase 7 (capacity matrix), Phase 5 (job data)**

### Database Migrations

None. All tables exist.

### Files to Create

```
src/lib/schedulingApi.js

src/modules/scheduling/AutoSchedulePanel.jsx
src/modules/scheduling/ScheduleRunConfig.jsx
src/modules/scheduling/ScheduleDiffTable.jsx

src/modules/scheduling/conflicts/ConflictList.jsx
src/modules/scheduling/conflicts/ConflictCard.jsx

src/modules/scheduling/tasks/TaskBoard.jsx
src/modules/scheduling/tasks/TaskCard.jsx

src/modules/scheduling/engine/index.js
src/modules/scheduling/engine/topologicalSort.js
src/modules/scheduling/engine/asapScheduler.js
src/modules/scheduling/engine/leveledScheduler.js
src/modules/scheduling/engine/conflictDetector.js

src/modules/scheduling/hooks/useAutoScheduleRun.js
src/modules/scheduling/hooks/useConflicts.js
src/modules/scheduling/hooks/useScheduledTasks.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/scheduling/*` routes
- `src/app/AppShell.jsx` — add Scheduling to nav
- `src/components/ProductionScheduler.jsx` — **IMPORTANT**: port the existing `overlaps` memo and `conflictDetector` logic into `src/modules/scheduling/engine/conflictDetector.js`. The scheduler component should call `detectConflicts(workingJobs)` (imported pure function) rather than recomputing inline. This is the **only** behavioral change to the existing scheduler in this phase. Visual output is identical; logic is now shared.
- `src/index.css` — append conflict card styles, diff table (green added / red removed cells), task board kanban column styles

### Breaking Change Warning

> **THE HIGHEST-RISK CHANGE IN THE ENTIRE PROJECT.** The existing drag-drop scheduler has its overlap detection logic inline in `ProductionScheduler.jsx`. Phase 8 extracts this to `conflictDetector.js`. The extraction must:
>
> 1. Be a pure copy first — extract without changing logic
> 2. Import back into `ProductionScheduler.jsx` and run both versions in parallel (assert same output in dev/test mode)
> 3. Remove old inline version only after step 2 passes for a week of real use
>
> Additionally, the auto-scheduler writes `planned_start`/`planned_end` to `job_routing_steps`. If those dates feed back into the Gantt (they don't currently — the Gantt reads `jobs.start`/`jobs.end`), there is no conflict. However, **confirm that `job_routing_steps.planned_start` does NOT overwrite `jobs.start`** — they are separate columns on separate tables.

### Key Implementation Notes

- The engine is a pure function: `runScheduler(input) → output`. It never touches the DB. The UI calls it, shows the diff, and the user clicks "Apply" to write.
- Engine output is a simple array of `{ id, jobId, plannedStart, plannedEnd }` diffs — not a full job object.
- `ScheduleDiffTable` shows before/after dates per step, color-coded. User can accept all, reject all, or cherry-pick rows.
- `conflictDetector.js` handles all 5 conflict types. The existing `overlaps` memo in the scheduler handles only `line_overlap` — the new detector is a superset.

### What You Can Demo After Phase 8

- Run auto-scheduler on selected jobs (ASAP or leveled strategy)
- Review proposed date changes in diff table before committing
- Apply schedule — `job_routing_steps` are updated; capacity heatmap updates live
- Conflict list shows all detected issues with severity
- Resolve conflicts manually with notes
- Task board shows `scheduled_tasks` per resource per day (manual task assignment, pre-dates full auto-scheduling)

---

## Phase 9: Material Planning

**Complexity: M**
**Depends on: Phase 4 (job_materials seeded from conversion), Phase 1 (materials, procurement_orders tables)**

### Database Migrations

None. All tables exist.

Optional: seed `materials` catalog from existing Excel/NetSuite item master if available. **User decision needed**: Is there a current item master to import? If yes, a one-time `INSERT` script goes here.

### Files to Create

```
src/lib/materialsApi.js

src/modules/materials/requirements/RequirementsList.jsx
src/modules/materials/requirements/RequirementsFilters.jsx

src/modules/materials/shortages/ShortageAlert.jsx

src/modules/materials/catalog/MaterialCatalog.jsx
src/modules/materials/catalog/MaterialForm.jsx

src/modules/materials/procurement/POList.jsx
src/modules/materials/procurement/PODetail.jsx
src/modules/materials/procurement/POForm.jsx
src/modules/materials/procurement/ReceiptEntry.jsx

src/modules/materials/hooks/useMaterialRequirements.js
src/modules/materials/hooks/useShortages.js
src/modules/materials/hooks/useMaterials.js
src/modules/materials/hooks/usePOs.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/materials/*` routes
- `src/app/AppShell.jsx` — add Materials to nav with shortage badge count
- `src/modules/production/jobs/JobMaterialsPanel.jsx` — remove placeholder; render actual `job_materials` with procurement status; add "Create PO" link
- `src/index.css` — append requirements table styles, shortage alert banner, PO detail line item grid

### Key Implementation Notes

- `ShortageAlert` is a persistent banner component rendered in `AppShell` when `useShortages()` returns count > 0. It shows "X items need ordering within 14 days" with a link to `/materials/shortages`.
- `createPOFromRequirements(requirementIds)` pre-populates the PO form from selected requirement rows — the user selects requirements in `RequirementsList` via checkboxes, then clicks "Create PO".
- `receivePOLines()` is a batch mutation: it updates `quantity_received` on lines AND recomputes `material_requirements.status` AND checks if the PO is fully received.
- The shortage window (14 days) is a constant in `src/utils/constants.js` — **user decision** on the right lead-time threshold.

### What You Can Demo After Phase 9

- Material requirements list grouped by job or by date
- Shortage alert banner in nav when items are overdue
- Create PO from selected requirements (form pre-populated)
- Mark lines received — requirement status updates automatically
- Material catalog: search, edit lead times, preferred supplier
- Job Detail → Materials tab now shows live procurement status per BOM line

---

## Phase 10: Dashboards

**Complexity: M**
**Depends on: All previous phases (reads from every module's tables)**

### Database Migrations

None.

### Files to Create

```
src/lib/dashboardsApi.js

src/modules/dashboards/DashboardShell.jsx
src/modules/dashboards/ExecutiveDashboard.jsx
src/modules/dashboards/SalesDashboard.jsx
src/modules/dashboards/ProductionDashboard.jsx
src/modules/dashboards/CapacityDashboard.jsx
src/modules/dashboards/OTDDashboard.jsx

src/modules/dashboards/charts/BarChart.jsx
src/modules/dashboards/charts/HorizontalBar.jsx
src/modules/dashboards/charts/FunnelChart.jsx
src/modules/dashboards/charts/SparkLine.jsx
src/modules/dashboards/charts/HeatGrid.jsx

src/modules/dashboards/hooks/useExecutiveMetrics.js
src/modules/dashboards/hooks/useSalesMetrics.js
src/modules/dashboards/hooks/useProductionMetrics.js
src/modules/dashboards/hooks/useOTDMetrics.js
src/modules/dashboards/hooks/useRevenueForecast.js
```

### Files to Modify

- `src/app/routes.jsx` — make `/` redirect to `/dashboard`; register `/dashboard/*` routes
- `src/app/AppShell.jsx` — Dashboard is now the default landing page (replaces the existing `activeModule="dashboard"` behavior inside `ProductionScheduler`)
- `src/index.css` — extract and formalize the existing `.ps-dashboard-grid`, `.ps-bridge-panel`, `.ps-metric-block` styles; append new chart SVG styles
- `src/components/ProductionScheduler.jsx` — the existing `ModuleWorkspace` "dashboard" tab can be kept as-is; the new `/dashboard` route is additive, not a replacement

### Key Implementation Notes

- All 5 dashboards share a `dateRange` state from `DashboardShell`'s date picker. The range is passed as a prop (not URL param) since these are live views, not shareable links.
- Charts are SVG with no external library. `BarChart` uses `viewBox` and percentage-based positioning. The `FunnelChart` is extracted from the existing `ModuleWorkspace` pipeline funnel JSX.
- `staleTime: 60_000` on all dashboard hooks — they refetch every minute automatically.
- OTD% formula: `jobs where actual_offline_date <= planned_offline_date / total completed jobs in period`.

### What You Can Demo After Phase 10

- Executive dashboard: pipeline forecast bar chart, WIP count, backlog, OTD%
- Sales dashboard: funnel, win rate, weighted forecast by rep
- Production dashboard: jobs by status/line, readiness distribution, risk list
- Capacity dashboard: 13-week heatmap (reuses Phase 7 component)
- OTD dashboard: planned vs. actual dates, late jobs list

---

## Phase 11: NetSuite Integration

**Complexity: L**
**Depends on: Phase 3 (quotes), Phase 9 (procurement_orders), Phase 2 (companies/contacts), Phase 1 (external_id_map, netsuite_sync_log)**

**BLOCKED UNTIL**: NetSuite account credentials are provided (see Pre-Flight Checklist).

### Database Migrations

None. Tables exist.

### Files to Create

```
supabase/functions/netsuite-sync/index.ts

src/modules/integrations/netsuite/NetSuitePanel.jsx
src/modules/integrations/netsuite/NetSuiteSyncControls.jsx

src/modules/integrations/hooks/useNetSuiteSync.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/integrations/netsuite`
- `src/lib/integrationsApi.js` — add NetSuite push/pull functions
- `src/modules/quoting/approvals/ApprovalPanel.jsx` — add "Push to NetSuite" button that appears after quote is approved
- `src/modules/materials/procurement/PODetail.jsx` — add "Push PO to NetSuite" button

### Key Implementation Notes

- The edge function authenticates using NetSuite's OAuth 1.0a token-based auth. All four credential values must be stored as Supabase secrets: `NETSUITE_ACCOUNT_ID`, `NETSUITE_TOKEN_KEY`, `NETSUITE_TOKEN_SECRET`, `NETSUITE_CONSUMER_KEY`, `NETSUITE_CONSUMER_SECRET`.
- The edge function handles: `push_quote` (creates Sales Order in NetSuite), `push_po` (creates Purchase Order), `push_customer` (creates Customer record), `pull_items` (syncs item master to `materials` table), `pull_customers` (syncs to `companies`).
- Every outbound call writes to `netsuite_sync_log`. On failure, the log shows the HTTP status and response body.
- `external_id_map` is written on successful create: `{ system:'netsuite', entity_type:'quote', internal_id: quoteId, external_id: netsuiteSOId }`.
- **User decision needed**: Does NetSuite use SuiteScript REST or the older SOAP API? The edge function implementation differs significantly. REST is assumed here.

### What You Can Demo After Phase 11

- Push an approved quote to NetSuite as a Sales Order; see the NetSuite SO number returned and stored
- Push a confirmed PO to NetSuite; see the NetSuite PO number returned
- Pull item master from NetSuite into the materials catalog
- Sync log viewer shows all operations with status, HTTP code, and payload

---

## Phase 12: Procore Integration

**Complexity: S**
**Depends on: Phase 5 (JobDetail Procore tab), Phase 1 (procore_sync_log, webhook_events tables)**

This phase is mostly additive to the existing Procore integration.

### Database Migrations

None. Tables exist. Seed note: existing `activity_log` entries with `action = 'procore_manual_sync'` are still valid and continue to appear in the activity feed.

### Files to Create

```
src/modules/integrations/procore/ProcorePanel.jsx    ← extends/wraps existing procore UI
src/modules/integrations/WebhookEventList.jsx
src/modules/integrations/SyncLogViewer.jsx

src/modules/integrations/hooks/useSyncLog.js
src/modules/integrations/hooks/useWebhookEvents.js
```

### Files to Modify

- `supabase/functions/procore-sync/index.ts` — add logging to `procore_sync_log` table on each sync operation (currently logs to `activity_log` only); add `webhook_events` queue processing for inbound webhooks
- `src/app/routes.jsx` — register `/integrations/procore`, `/integrations/log`
- `src/app/AppShell.jsx` — add Integrations to nav with webhook backlog badge
- `src/lib/integrationsApi.js` — add `bulkPullFromProcore`, `fetchProcoreSyncLog`, `fetchWebhookEvents`, `retryWebhookEvent`
- `src/index.css` — append sync log table styles, webhook event status badges

### Breaking Change Warning

> **NONE.** The existing `pullFromProcore()` function and `ProcoreLiveTab` component are untouched. The new `ProcorePanel` at `/integrations/procore` adds bulk sync controls and the new `procore_sync_log` viewer alongside the existing per-job pull functionality. The existing `activity_log` entries continue to be written as before.

### What You Can Demo After Phase 12

- Bulk sync multiple jobs to Procore from a single panel
- `procore_sync_log` shows per-job sync history with counts (submittals, RFIs, punch items synced)
- Webhook event queue: see inbound events, retry failed ones
- Unified sync log viewer with tabs for Procore / NetSuite / Webhooks
- Existing per-job Procore sync in `JobDetail` continues to work identically

---

## Phase 13: AI Intake

**Complexity: M**
**Depends on: Phase 2 (leads and opportunities creation), Phase 1 (intake_drafts table)**

**BLOCKED UNTIL**: Anthropic Claude API key is provided (see Pre-Flight Checklist).

### Database Migrations

```sql
-- intake_drafts was not in the original schema document — add to migration
CREATE TABLE intake_drafts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type           TEXT CHECK (source_type IN ('email','pdf','manual')),
    raw_text              TEXT,
    parsed_json           JSONB,
    confidence            NUMERIC(4,3),
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','reviewed','converted','rejected')),
    converted_entity_type TEXT CHECK (converted_entity_type IN ('lead','opportunity')),
    converted_entity_id   TEXT,
    reviewed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at           TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE intake_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scm_intake_drafts_all" ON intake_drafts FOR ALL TO authenticated USING (TRUE);
```

### Files to Create

```
supabase/functions/ai-intake/index.ts

src/lib/aiIntakeApi.js

src/modules/ai-intake/IntakeInbox.jsx
src/modules/ai-intake/IntakeDraftReview.jsx
src/modules/ai-intake/ParsedDraftForm.jsx
src/modules/ai-intake/IntakeUpload.jsx

src/modules/ai-intake/hooks/useIntakeDrafts.js
src/modules/ai-intake/hooks/useParseDocument.js
```

### Files to Modify

- `src/app/routes.jsx` — register `/ai-intake/*` routes
- `src/app/AppShell.jsx` — add AI Intake to nav with pending count badge
- `src/index.css` — append intake inbox styles, split-pane review layout, confidence meter bar

### Key Implementation Notes

- The edge function `ai-intake/index.ts` calls the Anthropic Messages API with a structured extraction prompt. The prompt instructs Claude to extract the fields listed in the architecture doc and return strict JSON. Wrap the call in a try/catch — if parsing fails, store `{ error: 'parse_failed', raw: responseText }` in `parsed_json.error` so the user can still see what Claude returned.
- Store the `ANTHROPIC_API_KEY` as a Supabase secret.
- `IntakeDraftReview` is a two-column layout: left shows the raw text (scrollable); right shows `ParsedDraftForm` with pre-filled but editable fields. The user corrects any extraction errors before converting.
- The confidence score (0–1) from Claude is shown as a colored bar: green ≥ 0.85, amber 0.7–0.85, red < 0.7.
- `rawFlags` array from Claude (fields it was uncertain about) highlights those form fields in amber.
- **User decision needed**: Should low-confidence drafts (< 0.70) require mandatory review before converting? Or just warn?

### What You Can Demo After Phase 13

- Paste an email body or RFQ text into the intake form
- Claude parses it and returns pre-filled lead/opportunity fields in ~2-3 seconds
- Review and correct the parsed fields
- One click converts to a Lead or Opportunity (pre-populated, no re-typing)
- Intake inbox shows all past drafts with status and confidence scores

---

## Dependency Graph Summary

```
Phase 1 (Foundation)
  └── Phase 2 (CRM)
        └── Phase 3 (Quoting)
              └── Phase 4 (Workflow)
                    ├── Phase 5 (Production Jobs)  ← also depends on Phase 1
                    │     └── Phase 9 (Materials)  ← also depends on Phase 4
                    └── Phase 6 (Routing Engine)   ← also depends on Phase 1
                          └── Phase 7 (Capacity)
                                └── Phase 8 (Scheduling) ← also depends on Phase 5, 6, 7

Phase 10 (Dashboards) ← depends on all phases 1-9, but can be built incrementally
Phase 11 (NetSuite)   ← depends on phases 1, 3, 9; blocked on credentials
Phase 12 (Procore)    ← depends on phases 1, 5; low-risk, can be done anytime after Phase 5
Phase 13 (AI Intake)  ← depends on phases 1, 2; blocked on API key
```

Phases 11, 12, and 13 have no downstream dependents — they can be parallelized with phases 9-10 if multiple developers are available.

---

## Consolidated Breaking Change Summary

| Phase | Risk Level | Change | Mitigation |
|-------|-----------|--------|-----------|
| 1 | None | New shell wraps existing scheduler | Scheduler mounted unchanged at `/production/scheduler` |
| 2 | Low | New `opportunities` table parallel to `sales_pipeline_deals` | Old Kanban reads old table; new CRM reads new table; no data deleted |
| 4 | Moderate | `useConvertOpportunity` writes to `jobs` table | Wizard enforces `line` and `start`/`end` fields; `normalizeJob()` handles both origins |
| 5 | High | Extract tab content from `ProductionScheduler.jsx` | Extract as copy → verify → then remove; never in same commit |
| 8 | High | Extract conflict detection from inline → `conflictDetector.js` | Run old and new in parallel in dev; assert equal output |
| 12 | None | Add logging to existing `procore-sync` function | Additive only; existing calls untouched |