# Complete React Application Architecture

## Top-Level Project Structure

```
src/
├── app/
│   ├── App.jsx                    # Router root, auth gate
│   ├── AppShell.jsx               # Topbar, sidebar nav, toast provider
│   ├── routes.jsx                 # Route definitions
│   └── queryClient.js             # React Query client config
├── modules/
│   ├── crm/
│   ├── quoting/
│   ├── workflow/
│   ├── production/
│   ├── routing/
│   ├── capacity/
│   ├── scheduling/
│   ├── materials/
│   ├── dashboards/
│   ├── ai-intake/
│   └── integrations/
├── components/
│   └── ui/                        # Shared design system components
├── hooks/                         # Shared cross-module hooks
├── lib/                           # API layers + Supabase client
├── store/                         # Zustand global stores
└── utils/                         # Pure helpers, formatters, constants
```

---

## Foundation Layer

### API Client Pattern

**`src/lib/supabase.js`** — single Supabase client instance, never re-imported raw anywhere else:
```js
// All modules import { supabase } from 'src/lib/supabase'
// Never call createClient() outside this file
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, storageKey: 'scm-auth' },
  realtime: { params: { eventsPerSecond: 10 } }
})
```

**`src/lib/apiBase.js`** — wrapper that normalizes errors and adds timing:
```js
export async function dbQuery(builderFn) {
  const t0 = Date.now()
  const { data, error } = await builderFn()
  if (error) throw new ApiError(error.message, error.code, Date.now() - t0)
  return data
}
```

Every module's `Api.js` file calls `dbQuery()` — no raw `.then()` chains on supabase builders scattered through components.

### Global State (Zustand)

**`src/store/authStore.js`**
```
{ user, session, profile, role, canViewPrices, signIn, signOut, refreshProfile }
```
- `profile` is the joined `user_profiles` row
- `role` drives permission gates across all modules
- `canViewPrices` is derived from role, passed as prop to financial components

**`src/store/appStore.js`**
```
{ activeModule, sidebarCollapsed, toasts, addToast, removeToast,
  globalSearch, setGlobalSearch, featureFlags }
```

**`src/store/realtimeStore.js`**
```
{ subscriptions: Map<channel, subscription>, subscribe, unsubscribe }
```
Central registry so components can subscribe without creating duplicate channels.

### React Query Client Config

**`src/app/queryClient.js`**
```js
// staleTime: 30s for reference data (departments, routing templates)
// staleTime: 0 for live ops (scheduled_tasks, conflicts)
// Retry: 2 for reads, 0 for mutations
// onError: global toast via appStore
```

Query key factory lives in each module's `Api.js`:
```js
export const crmKeys = {
  companies: () => ['crm', 'companies'],
  company: (id) => ['crm', 'companies', id],
  contacts: (companyId) => ['crm', 'contacts', companyId],
  ...
}
```

---

## Shared Component Library (`src/components/ui/`)

All components use the existing `ps-*` CSS class system. No new design system is introduced — the library wraps existing patterns in reusable React components.

| File | Component | Description |
|---|---|---|
| `Button.jsx` | `<Button variant size>` | Wraps existing `.ps-button` variants |
| `StatusChip.jsx` | `<StatusChip status>` | Maps status strings to pill colors |
| `Modal.jsx` | `<Modal open onClose title>` | Portal-based modal with backdrop |
| `SlideOver.jsx` | `<SlideOver open onClose title width>` | Right-side drawer (used for all detail panels) |
| `DataTable.jsx` | `<DataTable columns data loading onRowClick>` | Sortable, filterable table with sticky header |
| `KanbanBoard.jsx` | `<KanbanBoard columns cards onCardMove onCardClick>` | Generic HTML5 DnD kanban (wraps existing PipelineKanban logic) |
| `FormField.jsx` | `<FormField label error hint>` + input children | Label + validation wrapper |
| `Select.jsx` | `<Select options value onChange>` | Styled native select |
| `DatePicker.jsx` | `<DatePicker value onChange>` | Thin wrapper, native `<input type="date">` |
| `CurrencyInput.jsx` | `<CurrencyInput value onChange canView>` | Respects `canViewPrices`; shows `$—` when false |
| `ProgressBar.jsx` | `<ProgressBar value color>` | Reuses job progress bar CSS |
| `Tabs.jsx` | `<Tabs tabs activeTab onChange>` | Tab strip (reuses `.ps-nav` styles) |
| `EmptyState.jsx` | `<EmptyState icon title action>` | Zero-state placeholder |
| `ConfirmDialog.jsx` | `<ConfirmDialog open message onConfirm onCancel>` | Destructive action gate |
| `SearchInput.jsx` | `<SearchInput value onChange placeholder>` | Debounced search box |
| `Badge.jsx` | `<Badge color>` | Small count/label badge |
| `Timeline.jsx` | Re-exports existing Gantt timeline | Shared entry point |
| `ActivityFeed.jsx` | `<ActivityFeed items loading>` | Chronological log renderer |
| `MetricCard.jsx` | `<MetricCard label value delta trend>` | Reuses `.ps-metric-block` |
| `SectionHeader.jsx` | `<SectionHeader title action>` | Module section heading |

---

## Top-Level Routing Structure

**`src/app/routes.jsx`** — React Router v6 nested routes:

```
/                           → redirect to /dashboard
/login                      → LoginPage (standalone, no shell)

/dashboard                  → DashboardsModule (default: Executive view)
  /dashboard/executive
  /dashboard/sales
  /dashboard/production
  /dashboard/capacity
  /dashboard/otd

/crm                        → CrmModule (shell with sub-nav)
  /crm/companies            → CompanyList
  /crm/companies/:id        → CompanyDetail
  /crm/contacts             → ContactList
  /crm/contacts/:id         → ContactDetail
  /crm/leads                → LeadList
  /crm/leads/:id            → LeadDetail
  /crm/opportunities        → OpportunityList (Kanban + List toggle)
  /crm/opportunities/:id    → OpportunityDetail
  /crm/activities           → ActivityList (my tasks, calendar)

/quoting
  /quoting/quotes           → QuoteList
  /quoting/quotes/new       → QuoteBuilder (new, requires opportunityId param)
  /quoting/quotes/:id       → QuoteBuilder (edit)
  /quoting/quotes/:id/rev/:rev → QuoteRevisionView (read-only snapshot)
  /quoting/approvals        → ApprovalQueue

/workflow
  /workflow/conversions     → ConversionQueue (award/handoff opps)
  /workflow/conversions/:oppId → ConversionWizard (multi-step)

/production
  /production/scheduler     → ProductionScheduler (EXISTING — preserved as-is)
  /production/jobs          → JobList (table view)
  /production/jobs/:id      → JobDetail (re-uses JobFactSheet as full page)
  /production/dispatch      → DispatchBoard (existing)

/routing-engine
  /routing-engine/templates       → TemplateList
  /routing-engine/templates/new   → TemplateBuilder
  /routing-engine/templates/:id   → TemplateBuilder (edit)
  /routing-engine/departments     → DepartmentManager

/capacity
  /capacity/overview        → CapacityHeatmap (all departments, date range)
  /capacity/departments/:id → DepartmentCapacityDetail
  /capacity/rules           → CapacityRuleEditor
  /capacity/calendar        → CapacityCalendar (blocks/holidays)

/scheduling
  /scheduling/auto-schedule → AutoSchedulePanel (run engine, review output)
  /scheduling/conflicts     → ConflictList
  /scheduling/tasks         → TaskBoard (resource view)

/materials
  /materials/requirements   → RequirementsList (by job, by date)
  /materials/catalog        → MaterialCatalog
  /materials/procurement    → POList
  /materials/procurement/:id → PODetail
  /materials/shortages      → ShortageAlert

/ai-intake
  /ai-intake/inbox          → IntakeInbox
  /ai-intake/review/:id     → IntakeDraftReview

/integrations
  /integrations/netsuite    → NetSuitePanel
  /integrations/procore     → ProcorePanel (extends existing)
  /integrations/excel       → ExcelSyncPanel (existing, moved here)
  /integrations/log         → SyncLogViewer
```

The existing `ProductionScheduler` component is mounted at `/production/scheduler` without modification. The new shell wraps it in `<AppShell>` and passes `activeModule` from the URL rather than internal state.

---

## Module 1: CRM

**`src/modules/crm/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `CrmModule` | `CrmModule.jsx` | Sub-router shell, CRM sidebar nav |
| `CompanyList` | `companies/CompanyList.jsx` | Searchable/filterable table with type filter |
| `CompanyDetail` | `companies/CompanyDetail.jsx` | Tabs: Overview, Contacts, Opportunities, Activities, Documents |
| `CompanyForm` | `companies/CompanyForm.jsx` | Create/edit company (used in SlideOver) |
| `ContactList` | `contacts/ContactList.jsx` | Filterable by company, role, owner |
| `ContactDetail` | `contacts/ContactDetail.jsx` | Tabs: Info, Activities, Linked Opps |
| `ContactForm` | `contacts/ContactForm.jsx` | Create/edit contact |
| `LeadList` | `leads/LeadList.jsx` | Board (status columns) + list toggle |
| `LeadDetail` | `leads/LeadDetail.jsx` | Full detail + qualify/convert actions |
| `LeadForm` | `leads/LeadForm.jsx` | Create/edit lead |
| `OpportunityList` | `opportunities/OpportunityList.jsx` | Kanban (wraps `KanbanBoard`) + list toggle |
| `OpportunityDetail` | `opportunities/OpportunityDetail.jsx` | 6-tab detail: Summary, Timeline, Contacts, Quotes, Activities, Files |
| `OpportunityForm` | `opportunities/OpportunityForm.jsx` | Create/edit opp — stage, financials, dates, team |
| `ActivityList` | `activities/ActivityList.jsx` | My tasks + team feed; grouped by due date |
| `ActivityForm` | `activities/ActivityForm.jsx` | Log call/email/meeting/task |
| `CrmDashboard` | `CrmDashboard.jsx` | Pipeline funnel, activity summary, forecast strip |

The existing `PipelineKanban.jsx` is migrated into `OpportunityList.jsx`. Its stage definitions, drag logic, and revenue forecast strip are preserved; only the data source changes from `usePipelineDeals` to `useOpportunities`.

### Custom Hooks

**`src/modules/crm/hooks/`**

| Hook | Query Keys | Behavior |
|---|---|---|
| `useCompanies(filters)` | `crmKeys.companies(filters)` | Paginated fetch with search/type filter |
| `useCompany(id)` | `crmKeys.company(id)` | Single company + related counts |
| `useContacts(filters)` | `crmKeys.contacts(filters)` | Filter by company, owner |
| `useOpportunities(filters)` | `crmKeys.opportunities(filters)` | Full list for Kanban; supports stage/owner/date filters |
| `useOpportunity(id)` | `crmKeys.opportunity(id)` | Single opp with joined company, contacts, quotes |
| `useLeads(filters)` | `crmKeys.leads(filters)` | Board-oriented: grouped by status |
| `useCrmActivities(entityType, entityId)` | `crmKeys.activities(entityType, entityId)` | Feed for any entity |
| `useCrmTasks(userId)` | `crmKeys.tasks(userId)` | My open tasks with overdue flag |
| `useStageMetrics()` | `crmKeys.stageMetrics()` | Aggregated weighted value per stage (dashboard) |

All mutation hooks follow the pattern:
```js
// useSaveCompany returns { mutate, mutateAsync, isPending, error }
// On success: invalidates crmKeys.companies() and crmKeys.company(id)
// On error: appStore.addToast({ type:'error', message })
```

### API Layer

**`src/lib/crmApi.js`**

```
fetchCompanies({ search, type, ownerId, page, limit })
  → SELECT * FROM companies WHERE ... ORDER BY name

fetchCompany(id)
  → companies + contacts count + opps count + recent activities

upsertCompany(company)
  → UPSERT companies ON CONFLICT(id)

deleteCompany(id)
  → soft delete: UPDATE companies SET is_active=false

fetchContacts({ companyId, search, ownerId })
  → contacts JOIN companies

upsertContact(contact)
fetchOpportunities({ stage, bdmId, estimatorId, search, dateRange })
  → opportunities JOIN companies JOIN user_profiles (bdm, estimator, pm)

fetchOpportunity(id)
  → opp + company + contacts + quotes summary + activities

upsertOpportunity(opp)
  → UPSERT opportunities; on stage change to 'award'/'handoff', emit event

fetchLeads({ status, assignedTo, search })
upsertLead(lead)
convertLeadToOpportunity(leadId, oppData)
  → INSERT opportunity, UPDATE lead SET status='converted', converted_opportunity_id

fetchCrmActivities(entityType, entityId)
upsertCrmActivity(activity)
fetchCrmTasks({ userId, status, dueBy })
upsertCrmTask(task)
```

### State Management

React Query for all server state. No Zustand store for CRM data — queries serve as the cache. The `useOpportunities` hook exposes a `setStage(oppId, newStage)` function that calls `useMutation` with optimistic update: immediately moves the card in the kanban cache, rolls back on error.

### Connections to Adjacent Modules

- **→ Quoting**: `OpportunityDetail` has a "New Quote" button that navigates to `/quoting/quotes/new?opportunityId=X`
- **→ Workflow**: Opps at `award`/`handoff` stage surface in the Conversion Queue
- **→ Dashboards**: `useStageMetrics()` feeds the revenue forecast dashboard
- **→ Activity Log**: CRM mutations call `logActivity()` (existing helper) for audit trail

---

## Module 2: Quoting

**`src/modules/quoting/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `QuoteList` | `QuoteList.jsx` | All quotes table — filter by status, opp, prepared_by |
| `QuoteBuilder` | `builder/QuoteBuilder.jsx` | Main quote editor — 4-panel layout |
| `QuoteHeader` | `builder/QuoteHeader.jsx` | Opportunity link, dates, status badge, action buttons |
| `LineItemGrid` | `builder/LineItemGrid.jsx` | Editable grid: category, description, qty, unit cost, unit price; uses `EditableCell` |
| `MarginCalculator` | `builder/MarginCalculator.jsx` | Real-time totals sidebar: subtotal, discount, tax, total, margin %, cost |
| `ScopeEditor` | `builder/ScopeEditor.jsx` | Inclusions / exclusions / assumptions text areas |
| `QuoteRevisionList` | `revisions/QuoteRevisionList.jsx` | Timeline of revisions for a quote |
| `QuoteRevisionView` | `revisions/QuoteRevisionView.jsx` | Read-only snapshot rendered from JSONB |
| `ApprovalQueue` | `approvals/ApprovalQueue.jsx` | Table of pending approval steps assigned to current user |
| `ApprovalPanel` | `approvals/ApprovalPanel.jsx` | Approve/reject with comment; shows quote summary |
| `QuotePDF` | `QuotePDF.jsx` | Print-ready view (window.print() CSS) for customer-facing quote |

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useQuote(id)` | Single quote + line items + revisions + approvals; refetches on focus |
| `useQuoteList(filters)` | Paginated list |
| `useQuoteLineItems(quoteId)` | Live array; mutations use optimistic updates on the local array before write |
| `useSaveQuote()` | Mutation: upsert quote header; on success invalidates quote and opp |
| `useSaveLineItem()` | Mutation: upsert single line item; triggers `recalcTotals()` side-effect |
| `useDeleteLineItem()` | Mutation: delete + recalc |
| `useCreateRevision()` | Snapshots current quote+items into `quote_revisions` JSONB |
| `useSubmitForApproval()` | Inserts `quote_approvals` rows for configured steps; sets quote status to `internal_review` |
| `useApprovalDecision()` | Updates approval step; if all approved, sets quote status to `approved` |
| `useApprovalQueue(userId)` | My pending approvals across all quotes |

### API Layer

**`src/lib/quotingApi.js`**

```
fetchQuotes({ opportunityId, status, preparedBy, search })
fetchQuote(id)
  → quote + line_items ordered by sort_order + approvals + latest revision

upsertQuote(quote)
upsertLineItem(lineItem)
deleteLineItem(id)
reorderLineItems(quoteId, orderedIds)
  → batch UPDATE sort_order

recalcQuoteTotals(quoteId)
  → SELECT SUM(extended_price), SUM(extended_cost) FROM quote_line_items
     UPDATE quotes SET subtotal, cost_total, total, margin_pct

snapshotRevision(quoteId, changeSummary)
  → SELECT max(revision_number)+1, INSERT quote_revisions with JSONB snapshot

fetchApprovalQueue(userId)
  → quote_approvals WHERE assigned_to = userId AND status = 'pending'
     JOIN quotes JOIN opportunities

submitApprovalDecision(approvalId, status, comments)
checkAllApproved(quoteId)
  → if all steps approved: UPDATE quotes SET status='approved', approved_by, approved_at
```

### State Management

React Query for server state. `QuoteBuilder` uses `useReducer` for local line-item editing state (add, edit, reorder, delete rows) before committing to the server. This avoids a network call on every keystroke. A `isDirty` flag shows a "Save" button; auto-save fires after 2s of inactivity (debounced `useMutation` call).

`MarginCalculator` is a pure component driven by the reducer state — no server calls needed for real-time margin display.

### Connections to Adjacent Modules

- **← CRM**: Receives `opportunityId` from URL param; links back to `OpportunityDetail`
- **→ Workflow**: Approved quotes at `handoff` stage feed the `ConversionWizard`
- **→ Materials**: Quote line items with `category='module'` seed the initial `job_materials` BOM on conversion
- **→ NetSuite Integration**: Approved quotes trigger `pushQuoteToNetsuite()` via the integration module

---

## Module 3: Opportunity-to-Production Workflow

**`src/modules/workflow/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `ConversionQueue` | `ConversionQueue.jsx` | Table of opps at `award`/`handoff` with approved quotes |
| `ConversionWizard` | `wizard/ConversionWizard.jsx` | 5-step wizard shell with step indicator |
| `Step1ReviewDeal` | `wizard/Step1ReviewDeal.jsx` | Read-only opp summary, approved quote total |
| `Step2AssignDetails` | `wizard/Step2AssignDetails.jsx` | Job number, PM, line assignment, start date |
| `Step3SetSchedule` | `wizard/Step3SetSchedule.jsx` | Inline mini-Gantt for setting key milestone dates |
| `Step4SelectRouting` | `wizard/Step4SelectRouting.jsx` | Pick routing template; shows step preview |
| `Step5Confirm` | `wizard/Step5Confirm.jsx` | Summary of job to be created; "Create Job" button |
| `HandoffChecklist` | `HandoffChecklist.jsx` | Post-conversion checklist: BOM created, routing assigned, milestones set |

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useConversionQueue()` | Opps in award/handoff with no `converted_job_id`, with approved quote |
| `useConversionWizard(oppId)` | Manages wizard step state + accumulated form data across steps |
| `useConvertOpportunity()` | Core mutation: see below |

`useConvertOpportunity()` mutation sequence (all in a Supabase RPC or sequential calls with rollback on any failure):
1. `INSERT INTO jobs` — creates production job from opp + quote data
2. `UPDATE opportunities SET converted_job_id, converted_at`
3. `UPDATE sales_pipeline_deals SET converted_job_id_fk, converted_at` (legacy sync)
4. `INSERT INTO job_milestones` — standard set from selected routing template
5. `INSERT INTO job_routing_steps` — instantiate all steps from template
6. `INSERT INTO job_materials` — seed BOM from approved quote line items (module/material categories)
7. `logActivity({ action: 'opportunity_converted', ... })` — two entries (opp + job)
8. Invalidate: `crmKeys.opportunities()`, `productionKeys.jobs()`, routing keys

### State Management

Wizard state lives in `useConversionWizard` — a `useReducer` with step-keyed sub-state. No server writes happen until Step 5 confirmation. This avoids partial records.

### Connections to Adjacent Modules

- **← CRM**: Reads from `opportunities` table; updates `converted_job_id` on opp
- **← Quoting**: Reads approved quote to seed job cost and line items
- **→ Production**: Creates the `jobs` row; navigates to `/production/jobs/:newId` on success
- **→ Routing**: Reads `routing_templates` for step 4; stamps `job_routing_steps`
- **→ Materials**: Creates initial `job_materials` from quote line items

---

## Module 4: Production Jobs

**`src/modules/production/`**

This module owns the existing scheduler and extends it with list/detail views.

### Components

| Component | File | Responsibility |
|---|---|---|
| `ProductionScheduler` | `scheduler/ProductionScheduler.jsx` | **EXISTING — unchanged** |
| `JobList` | `jobs/JobList.jsx` | Table view with status, PM, line, readiness filters |
| `JobDetail` | `jobs/JobDetail.jsx` | Full-page version of `JobFactSheet` (8 tabs, same structure) |
| `JobForm` | `jobs/JobForm.jsx` | Create/edit job form (used in scheduler and standalone) |
| `JobMilestones` | `jobs/JobMilestones.jsx` | Milestone timeline within JobDetail Schedule tab |
| `JobReadinessPanel` | `jobs/JobReadinessPanel.jsx` | 4-field readiness checklist with score |
| `JobRoutingPanel` | `jobs/JobRoutingPanel.jsx` | Shows `job_routing_steps` status within JobDetail |
| `JobMaterialsPanel` | `jobs/JobMaterialsPanel.jsx` | BOM + procurement status per line item |
| `DispatchBoard` | `dispatch/DispatchBoard.jsx` | **EXISTING — unchanged** |

`JobDetail` is structurally identical to the existing `JobFactSheet` drawer but rendered as a full route. The fact sheet drawer continues to work in the scheduler context. They share the same tab content components.

### Custom Hooks

| Hook | Source | Behavior |
|---|---|---|
| `useJobs(filters)` | **EXISTING** | Unchanged; Supabase-backed with localStorage fallback |
| `useJob(id)` | new | Single job with joins: milestones, routing steps, materials, activities |
| `useSaveJob()` | extends existing `persistJobs` | Wraps existing upsert; invalidates job list query |
| `useJobMilestones(jobId)` | new | CRUD for `job_milestones` |
| `useJobRoutingSteps(jobId)` | new | Live routing step statuses; real-time sub |
| `useJobMaterials(jobId)` | new | BOM with procurement status rollup |

### API Layer

**`src/lib/productionApi.js`** (extends existing `jobsApi.js` patterns)

```
fetchJobs(filters)           → existing SELECT from jobs
fetchJob(id)                 → job + milestones + routing_steps + materials summary
upsertJob(job)               → existing UPSERT
fetchJobMilestones(jobId)
upsertJobMilestone(milestone)
fetchJobRoutingSteps(jobId)  → job_routing_steps ORDER BY step_number
updateRoutingStepStatus(id, status, pct, actualStart, actualEnd)
fetchJobMaterials(jobId)     → job_materials + procurement_status rollup
```

### Real-time Subscriptions

```
channel: 'production-jobs'
  → postgres_changes on jobs table
  → on UPDATE: update React Query cache for useJobs() and useJob(id)

channel: 'job-routing-{jobId}'
  → postgres_changes on job_routing_steps WHERE job_id = X
  → updates useJobRoutingSteps(jobId) cache
  → triggers re-evaluation of job progress percentage
```

### Connections to Adjacent Modules

- **← Workflow**: Receives new jobs from conversion wizard
- **→ Scheduling**: `job_routing_steps` are the input to the auto-scheduler
- **→ Materials**: `job_materials` panel links to materials module shortage view
- **→ Procore**: Existing `ProcoreLiveTab` continues to work within `JobDetail`

---

## Module 5: Routing Engine

**`src/modules/routing/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `TemplateList` | `TemplateList.jsx` | Cards grouped by building type; clone, archive actions |
| `TemplateBuilder` | `builder/TemplateBuilder.jsx` | Two-panel: step list (left) + step editor (right) |
| `StepList` | `builder/StepList.jsx` | Drag-to-reorder list of routing steps; parallel groups shown as banded rows |
| `StepForm` | `builder/StepForm.jsx` | Edit step: name, dept, duration type, hours, predecessor, parallel group |
| `StepDurationCalc` | `builder/StepDurationCalc.jsx` | Preview: given N modules and crew size, shows computed hours and calendar days |
| `DepartmentManager` | `departments/DepartmentManager.jsx` | CRUD for departments; assigns production line, color |
| `RoutingPreview` | `RoutingPreview.jsx` | Mini read-only Gantt showing template steps as proportional bars |

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useRoutingTemplates(filters)` | List; filter by building_type, is_active |
| `useRoutingTemplate(id)` | Single template + ordered steps |
| `useSaveTemplate()` | Upsert template header |
| `useSaveStep()` | Upsert step; reorders siblings if step_number conflicts |
| `useDeleteStep(templateId)` | Delete + renumber remaining steps |
| `useReorderSteps(templateId)` | Batch UPDATE step_number values after drag |
| `useDepartments()` | All departments; cached with 5m staleTime (rarely changes) |
| `useSaveDepartment()` | Upsert department |

### API Layer

**`src/lib/routingApi.js`**

```
fetchTemplates({ buildingType, isActive })
fetchTemplate(id)           → template + routing_steps + departments (joined)
upsertTemplate(template)
cloneTemplate(id, newName)  → INSERT template + copy all steps with new IDs
upsertStep(step)
deleteStep(id)
reorderSteps(templateId, orderedIds)
  → batch UPDATE routing_steps SET step_number

computeTemplateDuration(templateId, modules, crewSize)
  → pure calculation: sum(duration_hours) considering parallel groups
    returns { totalHours, calendarDays, criticalPath }

fetchDepartments()
upsertDepartment(dept)
```

`computeTemplateDuration` is a pure JS function, not a DB query — it operates on the already-fetched steps array. This makes the `StepDurationCalc` component instantaneous.

### State Management

React Query for all data. `TemplateBuilder` uses `useReducer` for local step editing (same pattern as `QuoteBuilder`) — edits are buffered locally, saved on explicit "Save" or on step navigation.

### Connections to Adjacent Modules

- **← Workflow**: `ConversionWizard` step 4 reads templates to stamp onto jobs
- **→ Capacity**: `routing_steps.department_id` + `duration_hours` are the inputs to capacity demand calculations
- **→ Scheduling**: `job_routing_steps` (the instantiated form of templates) drive the auto-scheduler

---

## Module 6: Capacity Planning

**`src/modules/capacity/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `CapacityHeatmap` | `CapacityHeatmap.jsx` | Grid: departments (rows) × weeks (cols); color-coded % utilization |
| `CapacityHeatmapCell` | `CapacityHeatmapCell.jsx` | Single cell with tooltip: demand hours / available hours, job list |
| `DepartmentCapacityDetail` | `DepartmentCapacityDetail.jsx` | Bar chart + job breakdown for one department over date range |
| `CapacityRuleEditor` | `rules/CapacityRuleEditor.jsx` | Table of `capacity_rules`; inline editing of shifts, hours, crew |
| `CapacityCalendar` | `calendar/CapacityCalendar.jsx` | Month view; `capacity_blocks` shown as colored day cells |
| `BlockForm` | `calendar/BlockForm.jsx` | Create/edit holiday or shutdown block |
| `CapacityForecast` | `CapacityForecast.jsx` | 13-week rolling chart: available hours vs. projected demand from pipeline |

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useCapacityRules(deptId)` | Rules for a department, current effective date |
| `useCapacityBlocks(dateRange)` | Blocks within range, all departments |
| `useCapacityMatrix(dateRange)` | Core computed hook — see below |
| `useSaveCapacityRule()` | Upsert with effectivity dates |
| `useSaveCapacityBlock()` | Upsert block |
| `useDepartmentLoad(deptId, dateRange)` | Weekly demand from `job_routing_steps` |

`useCapacityMatrix(dateRange)`:
1. Fetches `capacity_rules` for all active departments
2. Fetches `capacity_blocks` for the date range
3. Fetches `job_routing_steps` with `planned_start`/`planned_end` in range (demand)
4. Computes per-department per-week: `available_hours` (rules × 5 days, adjusted by blocks), `demand_hours` (sum of routing step hours falling in week)
5. Returns a 2D matrix keyed by `[deptId][weekKey]` with `{ available, demand, pct, jobs[] }`

This is computed in a `useMemo` after all three queries resolve — no server-side aggregation needed at this scale.

### API Layer

**`src/lib/capacityApi.js`**

```
fetchCapacityRules({ deptId })
upsertCapacityRule(rule)

fetchCapacityBlocks({ startDate, endDate, deptId })
upsertCapacityBlock(block)
deleteCapacityBlock(id)

fetchDepartmentDemand(deptId, startDate, endDate)
  → SELECT job_id, step_number, planned_start, planned_end, planned_hours, status
     FROM job_routing_steps
     WHERE department_id = X AND planned_start <= endDate AND planned_end >= startDate
     AND status NOT IN ('complete','skipped')

fetchForecastDemand(startDate, endDate)
  → weighted pipeline demand: opportunities WHERE expected_start_date IN range
    × modules × avg_hours_per_module (config constant)
```

### Connections to Adjacent Modules

- **← Routing**: Step `department_id` and `duration_hours` are the demand inputs
- **← Production**: `job_routing_steps` provide actual planned dates for demand
- **→ Scheduling**: Capacity matrix is read by the auto-scheduler to avoid over-allocation
- **→ Dashboards**: Capacity utilization feeds the capacity dashboard panel

---

## Module 7: Auto Scheduling Engine

**`src/modules/scheduling/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `AutoSchedulePanel` | `AutoSchedulePanel.jsx` | Configure + run the engine; shows diff of proposed vs. current schedule |
| `ScheduleRunConfig` | `ScheduleRunConfig.jsx` | Input: which jobs to reschedule, date range, strategy (ASAP/leveled) |
| `ScheduleDiffTable` | `ScheduleDiffTable.jsx` | Before/after comparison of step dates; accept/reject per-row |
| `ConflictList` | `conflicts/ConflictList.jsx` | Table of `schedule_conflicts`; group by type, severity |
| `ConflictCard` | `conflicts/ConflictCard.jsx` | Single conflict with resolve action |
| `TaskBoard` | `tasks/TaskBoard.jsx` | Kanban grouped by resource; shows scheduled_tasks for a date range |
| `TaskCard` | `tasks/TaskCard.jsx` | Single task card with status update action |

### Scheduling Engine (`src/modules/scheduling/engine/`)

The engine runs in the browser (sufficient for ~200 jobs × ~15 steps). It is a pure function with no side effects — the UI calls it, reviews the output, then writes to DB on confirmation.

**`engine/index.js`** — `runScheduler(input) → output`:

```
Input:
  jobs: Job[]               — jobs to schedule (from jobs table)
  routingSteps: Map<jobId, RoutingStep[]>   — from job_routing_steps
  capacityMatrix: CapacityMatrix            — from useCapacityMatrix
  strategy: 'asap' | 'leveled'
  horizonStart: Date
  horizonEnd: Date

Output:
  scheduledSteps: ScheduledStep[]           — proposed planned_start/end per step
  conflicts: Conflict[]                     — detected issues
  utilizationByWeek: UtilizationEntry[]     — load summary for review
```

**`engine/topologicalSort.js`** — sorts steps within a job respecting `predecessor_step` and `parallel_group`:
- Builds adjacency list from `predecessor_step` column
- Kahn's algorithm for topological order
- Groups parallel steps (same `parallel_group`) into sets that can run simultaneously

**`engine/asapScheduler.js`** — for each job (ordered by priority, then start date):
1. Topologically sort its routing steps
2. Assign `planned_start` = max(`job.start`, `predecessor.planned_end + lag_hours`)
3. Check department capacity for each day in the proposed window
4. If capacity exhausted: push start date forward to next available capacity slot
5. Assign `planned_end` = `planned_start + duration` (adjusted for capacity_blocks)

**`engine/leveledScheduler.js`** — same as ASAP but uses a min-heap sorted by department load per week; assigns steps to the least-loaded week that satisfies precedence.

**`engine/conflictDetector.js`** — after scheduling:
- `resource_double_book`: a resource assigned to overlapping tasks
- `line_overlap`: existing Gantt overlap logic (ported from `ProductionScheduler` `overlaps` memo)
- `capacity_exceeded`: department weekly demand > available hours × 1.0
- `dependency_violated`: `planned_start < predecessor.planned_end`
- `late_delivery`: job's last step `planned_end > job.due`

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useAutoScheduleRun()` | Orchestrates: fetch inputs → run engine → return diff for review |
| `useApplySchedule(diff)` | Mutation: bulk UPDATE `job_routing_steps` with proposed dates |
| `useConflicts(filters)` | Live list from `schedule_conflicts`; real-time sub |
| `useResolveConflict()` | Mark resolved + note |
| `useScheduledTasks(filters)` | `scheduled_tasks` for task board; filter by resource, dept, date |
| `useUpdateTaskStatus()` | Optimistic status update on task card |

### API Layer

**`src/lib/schedulingApi.js`**

```
fetchSchedulingInputs(jobIds)
  → jobs + job_routing_steps (all steps for listed jobs) + capacity_rules + capacity_blocks

bulkUpdateRoutingSteps(steps)
  → batch UPSERT job_routing_steps (id, planned_start, planned_end)

persistConflicts(conflicts)
  → DELETE old unresolved conflicts for affected jobs
    INSERT new conflicts

fetchConflicts({ resolved, severity, deptId, jobId })
updateConflict(id, { is_resolved, resolution_note, resolved_by })

fetchScheduledTasks({ resourceId, deptId, startDate, endDate, status })
upsertScheduledTask(task)
updateTaskStatus(id, status, actualStart, actualEnd)
```

### Connections to Adjacent Modules

- **← Production**: Reads `job_routing_steps` as scheduling input
- **← Capacity**: Reads capacity matrix to constrain assignments
- **← Routing**: Step durations and predecessor rules come from the routing template design
- **→ Dashboards**: On-time delivery metrics read from `scheduled_tasks` vs. `job.due`

---

## Module 8: Material Planning

**`src/modules/materials/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `RequirementsList` | `requirements/RequirementsList.jsx` | Grouped by job or by date; shows procurement status per row |
| `RequirementsFilters` | `requirements/RequirementsFilters.jsx` | Filter: job, category, status, date range |
| `ShortageAlert` | `shortages/ShortageAlert.jsx` | Items where `required_by_date` is within 14 days and status != received |
| `MaterialCatalog` | `catalog/MaterialCatalog.jsx` | Item master table with search; edit lead time, cost, supplier |
| `MaterialForm` | `catalog/MaterialForm.jsx` | Create/edit material |
| `POList` | `procurement/POList.jsx` | PO table with status filter; supplier, total, required date |
| `PODetail` | `procurement/PODetail.jsx` | PO header + line items grid + receipt tracking |
| `POForm` | `procurement/POForm.jsx` | Create/edit PO; auto-populate from selected requirements |
| `ReceiptEntry` | `procurement/ReceiptEntry.jsx` | Mark lines received; updates `quantity_received` and requirement status |

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useMaterialRequirements(filters)` | Filter by job, status, date; sorted by required_by_date |
| `useShortages()` | Requirements due within `config.shortageWindowDays` (default 14) with `status NOT IN ('received','complete')` |
| `useMaterials(filters)` | Catalog with search; 60s staleTime |
| `usePOs(filters)` | PO list |
| `usePO(id)` | Single PO + line items + linked requirements |
| `useCreatePOFromRequirements()` | Mutation: creates PO header + lines from selected requirement IDs |
| `useReceiveLines()` | Mutation: batch update received quantities; updates requirement statuses |

### API Layer

**`src/lib/materialsApi.js`**

```
fetchMaterialRequirements({ jobId, status, category, startDate, endDate })
upsertMaterialRequirement(req)
fetchShortages(windowDays)
  → requirements WHERE required_by_date <= NOW() + interval
    AND status NOT IN ('received','complete')
    ORDER BY required_by_date

fetchMaterials({ category, search })
upsertMaterial(material)

fetchPOs({ status, supplierId, search })
fetchPO(id)           → po + procurement_order_lines + linked requirements
createPO(po, lines)   → INSERT po header + lines; UPDATE requirements status
upsertPOLine(line)
receivePOLines(poId, receipts)
  → UPDATE procurement_order_lines SET quantity_received
    UPDATE material_requirements SET quantity_received, status
    if fully received: UPDATE procurement_orders SET status='received', received_date
```

### Connections to Adjacent Modules

- **← Workflow**: Job BOM seeded on conversion from quote line items
- **← Production**: `JobMaterialsPanel` links into this module's data
- **→ NetSuite Integration**: `pushPOToNetsuite()` called on PO confirmation
- **→ Dashboards**: Shortage count feeds the WIP dashboard risk panel

---

## Module 9: Dashboards

**`src/modules/dashboards/`**

### Components

| Dashboard | File | Key Metrics / Charts |
|---|---|---|
| `ExecutiveDashboard` | `ExecutiveDashboard.jsx` | Revenue forecast bar (weighted pipeline by month), WIP value, backlog, OTD %, active jobs count |
| `SalesDashboard` | `SalesDashboard.jsx` | Pipeline funnel, win rate, avg deal size, weighted forecast, activity count by rep |
| `ProductionDashboard` | `ProductionDashboard.jsx` | Jobs by status, line utilization bars, risk list, readiness distribution |
| `CapacityDashboard` | `CapacityDashboard.jsx` | 13-week heatmap, overloaded departments highlight, forecast demand overlay |
| `OTDDashboard` | `OTDDashboard.jsx` | On-time delivery: planned vs. actual off-line dates; late job list |
| `DashboardShell` | `DashboardShell.jsx` | Tab switcher for the 5 views; date range picker that propagates to all |

Shared chart components (lightweight, no charting library — use SVG + CSS):

| Component | File | Type |
|---|---|---|
| `BarChart` | `charts/BarChart.jsx` | Vertical bars, category axis |
| `HorizontalBar` | `charts/HorizontalBar.jsx` | Single-series horizontal bar (capacity utilization) |
| `FunnelChart` | `charts/FunnelChart.jsx` | Pipeline stage funnel (existing bridge panel, extracted) |
| `SparkLine` | `charts/SparkLine.jsx` | Inline SVG trend line for metric cards |
| `HeatGrid` | `charts/HeatGrid.jsx` | 2D color-coded grid (reused from capacity module) |

No external charting library is added. SVG-based charts keep bundle size down and match the existing CSS design language.

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useExecutiveMetrics(dateRange)` | Aggregates: pipeline weighted total, WIP job count, revenue forecast by month |
| `useSalesMetrics(dateRange)` | Win rate, avg close time, activity counts by user |
| `useProductionMetrics(dateRange)` | Jobs by status/line, avg readiness, risk counts |
| `useOTDMetrics(dateRange)` | Late jobs, OTD%, avg days late, by PM |
| `useRevenueForecast(months)` | Weighted close amounts bucketed by month from opportunities |

All dashboard hooks use React Query with `staleTime: 60_000` — dashboards refresh every minute. They aggregate across multiple tables via single Supabase queries using `.select()` with aggregates where possible; for cross-table aggregates, two parallel queries are fetched and combined in JS.

### Connections to Adjacent Modules

- **← CRM**: Stage metrics, activity counts, pipeline weighted values
- **← Production**: Job status counts, readiness scores, WIP
- **← Capacity**: Utilization matrix
- **← Scheduling**: OTD data from routing step actual vs. planned dates

---

## Module 10: AI Intake

**`src/modules/ai-intake/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `IntakeInbox` | `IntakeInbox.jsx` | List of incoming documents (emails, PDFs, RFQs); status: pending/reviewed/converted |
| `IntakeDraftReview` | `IntakeDraftReview.jsx` | Side-by-side: raw document (left) + parsed draft (right) with edit fields |
| `ParsedDraftForm` | `ParsedDraftForm.jsx` | Editable form pre-filled by AI; creates Lead or Opportunity on confirm |
| `IntakeUpload` | `IntakeUpload.jsx` | Drag-to-upload or paste email body for manual intake |

### Architecture

AI parsing runs in a Supabase Edge Function: `supabase/functions/ai-intake/index.ts`

Input: `{ documentText: string, documentType: 'email'|'pdf'|'rfq'|'po' }`

Output (structured JSON):
```js
{
  opportunityName: string,
  client: string,
  buildingType: string,
  estimatedModules: number,
  estimatedValue: number,
  deliveryCity: string,
  deliveryState: string,
  bidDueDate: string,       // ISO date
  expectedOccupancyDate: string,
  scopeSummary: string,
  contactName: string,
  contactEmail: string,
  contactPhone: string,
  confidence: number,       // 0-1
  rawFlags: string[]        // items the AI was uncertain about
}
```

The edge function calls the Claude API with a structured extraction prompt. The response is stored in a new `intake_drafts` table:

```sql
-- (added to migration, not in original schema)
CREATE TABLE intake_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT, -- 'email','pdf','manual'
    raw_text TEXT,
    parsed_json JSONB,
    confidence NUMERIC(4,3),
    status TEXT DEFAULT 'pending', -- pending/reviewed/converted/rejected
    converted_entity_type TEXT,    -- 'lead' or 'opportunity'
    converted_entity_id TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useIntakeDrafts(status)` | List of pending/reviewed drafts |
| `useIntakeDraft(id)` | Single draft with parsed fields |
| `useParseDocument()` | Mutation: POST to edge function, INSERT intake_draft row |
| `useConvertDraftToLead()` | Mutation: INSERT lead from draft fields, UPDATE draft status |
| `useConvertDraftToOpportunity()` | Mutation: INSERT opportunity + company (if new) + contact (if new), UPDATE draft status |

### API Layer

**`src/lib/aiIntakeApi.js`**

```
parseDocument({ text, type })
  → POST supabase functions 'ai-intake'
  → INSERT intake_drafts with response

fetchIntakeDrafts(status)
fetchIntakeDraft(id)
convertDraftToLead(draftId, leadData)
convertDraftToOpportunity(draftId, oppData)
rejectDraft(draftId)
```

---

## Module 11: Integration Layer

**`src/modules/integrations/`**

### Components

| Component | File | Responsibility |
|---|---|---|
| `NetSuitePanel` | `netsuite/NetSuitePanel.jsx` | Connection status, sync controls, error log |
| `NetSuiteSyncControls` | `netsuite/NetSuiteSyncControls.jsx` | Per-entity-type sync buttons: Customers, Items, POs, SOs |
| `ProcorePanel` | `procore/ProcorePanel.jsx` | Extends existing Procore sync UI; adds bulk sync controls and log |
| `ExcelSyncPanel` | `excel/ExcelSyncPanel.jsx` | Existing Excel sync UI, moved from ProductionScheduler settings |
| `SyncLogViewer` | `SyncLogViewer.jsx` | Unified log: tabs for NetSuite / Procore / Webhook events |
| `WebhookEventList` | `WebhookEventList.jsx` | Pending / failed webhook events with retry button |

### NetSuite Integration Architecture

A Supabase Edge Function handles all NetSuite REST API calls server-side (avoids CORS and credential exposure):

**`supabase/functions/netsuite-sync/index.ts`**

Endpoints triggered by the UI via `POST /functions/v1/netsuite-sync`:
```
{ operation: 'push_quote', payload: { quoteId } }
{ operation: 'push_po', payload: { poId } }
{ operation: 'push_customer', payload: { companyId } }
{ operation: 'pull_items', payload: {} }
{ operation: 'pull_customers', payload: {} }
```

The edge function:
1. Reads NetSuite credentials from Supabase secrets (`NETSUITE_ACCOUNT`, `NETSUITE_TOKEN_KEY`, etc.)
2. Calls NetSuite SuiteScript REST API
3. Writes results to `external_id_map` and `netsuite_sync_log`
4. Returns `{ status, netsuite_id, errors }`

### Custom Hooks

| Hook | Behavior |
|---|---|
| `useSyncLog(system, filters)` | Filtered sync log; 10s staleTime for live monitoring |
| `useWebhookEvents(status)` | Pending/failed webhook events; real-time sub |
| `useNetSuiteSync()` | Mutations for each entity type push/pull |
| `useProcoreSync()` | Extends existing `pullFromProcore()` with batch controls |
| `useRetryWebhookEvent()` | Mutation: re-queue failed webhook event |

### API Layer

**`src/lib/integrationsApi.js`**

```
-- NetSuite
pushQuoteToNetsuite(quoteId)
  → POST supabase functions 'netsuite-sync' { operation: 'push_quote', quoteId }
pushPOToNetsuite(poId)
pullNetSuiteItems()
pullNetSuiteCustomers()
fetchNetSuiteSyncLog({ entityType, status, limit })

-- Procore (extends existing)
pullJobFromProcore(jobId, jobNumber)  — existing, unchanged
bulkPullFromProcore(jobIds)           — new: sequential calls with rate limiting
fetchProcoreSyncLog({ jobId, limit })

-- Webhooks
fetchWebhookEvents({ status, source })
retryWebhookEvent(id)
  → UPDATE webhook_events SET status='pending', retry_count++ 

-- External ID Map
fetchExternalIds(entityType, internalId)
upsertExternalId(mapping)
```

### Real-time Subscriptions

```
channel: 'webhook-events'
  → postgres_changes on webhook_events WHERE status = 'pending'
  → badgeCount in nav shows pending webhook backlog
  → toasts on 'failed' status updates

channel: 'procore-sync-log'
  → postgres_changes on procore_sync_log
  → updates ProcorePanel live progress during bulk sync
```

---

## Cross-Module Wiring

### How Modules Connect (data flow summary)

```
AI Intake
  ↓ creates
CRM (Lead → Opportunity)
  ↓ spawns
Quoting (Quote → approved)
  ↓ triggers
Workflow (ConversionWizard)
  ↓ creates
Production Jobs ──────────────────────┐
  ↓ stamps                             │
Routing Engine (job_routing_steps)    │ (job record shared)
  ↓ feeds                              │
Capacity Planning (demand)            │
  ↓ constrains                         │
Auto Scheduling (planned dates)        │
  ↓ drives                             │
Material Planning (required_by dates) ◄┘
  ↓ triggers
Integrations (NetSuite PO push, Procore sync)

Dashboards ← read from all of the above
```

### Shared Event Pattern

Rather than prop-drilling callbacks across modules, cross-module coordination uses React Query cache invalidation as the event bus:

```js
// In ConversionWizard after job created:
queryClient.invalidateQueries({ queryKey: productionKeys.jobs() })
queryClient.invalidateQueries({ queryKey: crmKeys.opportunity(oppId) })
queryClient.invalidateQueries({ queryKey: routingKeys.jobSteps(newJobId) })
queryClient.invalidateQueries({ queryKey: dashboardKeys.production() })
```

No custom event emitter or pub/sub is needed. React Query's invalidation cascade handles re-render propagation.

### Navigation Between Modules

Cross-module navigation uses React Router `<Link>` or `useNavigate`:
- Opportunity detail → "New Quote": `navigate('/quoting/quotes/new?opportunityId=' + id)`
- Quote approved → "Convert to Job": `navigate('/workflow/conversions/' + oppId)`
- Job created → lands at: `navigate('/production/jobs/' + newJobId)`
- Job detail Procore tab → existing `ProcoreLiveTab` unchanged
- Material shortage → "Create PO": `navigate('/materials/procurement/new?requirementIds=' + ids.join(','))`

---

## File Structure Reference (complete)

```
src/
├── app/
│   ├── App.jsx
│   ├── AppShell.jsx
│   ├── routes.jsx
│   └── queryClient.js
│
├── store/
│   ├── authStore.js
│   ├── appStore.js
│   └── realtimeStore.js
│
├── lib/
│   ├── supabase.js
│   ├── apiBase.js
│   ├── crmApi.js
│   ├── quotingApi.js
│   ├── workflowApi.js
│   ├── productionApi.js
│   ├── routingApi.js
│   ├── capacityApi.js
│   ├── schedulingApi.js
│   ├── materialsApi.js
│   ├── dashboardsApi.js
│   ├── aiIntakeApi.js
│   ├── integrationsApi.js
│   ├── pipelineApi.js          ← EXISTING, unchanged
│   └── jobsApi.js              ← EXISTING, unchanged
│
├── hooks/
│   ├── useJobs.js              ← EXISTING, unchanged
│   ├── usePipelineDeals.js     ← EXISTING, unchanged
│   ├── useSubmittals.js        ← EXISTING, unchanged
│   ├── useUserProfiles.js      ← EXISTING, unchanged
│   ├── useRealtime.js          ← new shared subscription helper
│   ├── useDebounce.js
│   ├── usePagination.js
│   └── usePermission.js        ← checks role from authStore
│
├── components/
│   └── ui/
│       ├── Button.jsx
│       ├── Modal.jsx
│       ├── SlideOver.jsx
│       ├── DataTable.jsx
│       ├── KanbanBoard.jsx
│       ├── FormField.jsx
│       ├── Select.jsx
│       ├── DatePicker.jsx
│       ├── CurrencyInput.jsx
│       ├── ProgressBar.jsx
│       ├── Tabs.jsx
│       ├── EmptyState.jsx
│       ├── ConfirmDialog.jsx
│       ├── SearchInput.jsx
│       ├── Badge.jsx
│       ├── ActivityFeed.jsx
│       ├── MetricCard.jsx
│       └── StatusChip.jsx
│
├── modules/
│   ├── crm/
│   │   ├── CrmModule.jsx
│   │   ├── CrmDashboard.jsx
│   │   ├── companies/
│   │   │   ├── CompanyList.jsx
│   │   │   ├── CompanyDetail.jsx
│   │   │   └── CompanyForm.jsx
│   │   ├── contacts/
│   │   │   ├── ContactList.jsx
│   │   │   ├── ContactDetail.jsx
│   │   │   └── ContactForm.jsx
│   │   ├── leads/
│   │   │   ├── LeadList.jsx
│   │   │   ├── LeadDetail.jsx
│   │   │   └── LeadForm.jsx
│   │   ├── opportunities/
│   │   │   ├── OpportunityList.jsx
│   │   │   ├── OpportunityDetail.jsx
│   │   │   └── OpportunityForm.jsx
│   │   ├── activities/
│   │   │   ├── ActivityList.jsx
│   │   │   └── ActivityForm.jsx
│   │   └── hooks/
│   │       ├── useCompanies.js
│   │       ├── useOpportunities.js
│   │       ├── useLeads.js
│   │       ├── useCrmActivities.js
│   │       └── useCrmTasks.js
│   │
│   ├── quoting/
│   │   ├── QuoteList.jsx
│   │   ├── builder/
│   │   │   ├── QuoteBuilder.jsx
│   │   │   ├── QuoteHeader.jsx
│   │   │   ├── LineItemGrid.jsx
│   │   │   ├── MarginCalculator.jsx
│   │   │   └── ScopeEditor.jsx
│   │   ├── revisions/
│   │   │   ├── QuoteRevisionList.jsx
│   │   │   └── QuoteRevisionView.jsx
│   │   ├── approvals/
│   │   │   ├── ApprovalQueue.jsx
│   │   │   └── ApprovalPanel.jsx
│   │   ├── QuotePDF.jsx
│   │   └── hooks/
│   │       ├── useQuote.js
│   │       ├── useQuoteLineItems.js
│   │       ├── useSaveQuote.js
│   │       └── useApprovalQueue.js
│   │
│   ├── workflow/
│   │   ├── ConversionQueue.jsx
│   │   ├── HandoffChecklist.jsx
│   │   ├── wizard/
│   │   │   ├── ConversionWizard.jsx
│   │   │   ├── Step1ReviewDeal.jsx
│   │   │   ├── Step2AssignDetails.jsx
│   │   │   ├── Step3SetSchedule.jsx
│   │   │   ├── Step4SelectRouting.jsx
│   │   │   └── Step5Confirm.jsx
│   │   └── hooks/
│   │       ├── useConversionQueue.js
│   │       ├── useConversionWizard.js
│   │       └── useConvertOpportunity.js
│   │
│   ├── production/
│   │   ├── scheduler/
│   │   │   └── ProductionScheduler.jsx  ← EXISTING, unchanged
│   │   ├── jobs/
│   │   │   ├── JobList.jsx
│   │   │   ├── JobDetail.jsx
│   │   │   ├── JobForm.jsx
│   │   │   ├── JobMilestones.jsx
│   │   │   ├── JobReadinessPanel.jsx
│   │   │   ├── JobRoutingPanel.jsx
│   │   │   └── JobMaterialsPanel.jsx
│   │   ├── dispatch/
│   │   │   └── DispatchBoard.jsx        ← EXISTING, unchanged
│   │   └── hooks/
│   │       ├── useJob.js
│   │       ├── useJobMilestones.js
│   │       ├── useJobRoutingSteps.js
│   │       └── useJobMaterials.js
│   │
│   ├── routing/
│   │   ├── TemplateList.jsx
│   │   ├── RoutingPreview.jsx
│   │   ├── builder/
│   │   │   ├── TemplateBuilder.jsx
│   │   │   ├── StepList.jsx
│   │   │   ├── StepForm.jsx
│   │   │   └── StepDurationCalc.jsx
│   │   ├── departments/
│   │   │   └── DepartmentManager.jsx
│   │   └── hooks/
│   │       ├── useRoutingTemplates.js
│   │       ├── useRoutingTemplate.js
│   │       └── useDepartments.js
│   │
│   ├── capacity/
│   │   ├── CapacityHeatmap.jsx
│   │   ├── CapacityHeatmapCell.jsx
│   │   ├── DepartmentCapacityDetail.jsx
│   │   ├── CapacityForecast.jsx
│   │   ├── rules/
│   │   │   └── CapacityRuleEditor.jsx
│   │   ├── calendar/
│   │   │   ├── CapacityCalendar.jsx
│   │   │   └── BlockForm.jsx
│   │   └── hooks/
│   │       ├── useCapacityMatrix.js
│   │       ├── useCapacityRules.js
│   │       ├── useCapacityBlocks.js
│   │       └── useDepartmentLoad.js
│   │
│   ├── scheduling/
│   │   ├── AutoSchedulePanel.jsx
│   │   ├── ScheduleRunConfig.jsx
│   │   ├── ScheduleDiffTable.jsx
│   │   ├── conflicts/
│   │   │   ├── ConflictList.jsx
│   │   │   └── ConflictCard.jsx
│   │   ├── tasks/
│   │   │   ├── TaskBoard.jsx
│   │   │   └── TaskCard.jsx
│   │   ├── engine/
│   │   │   ├── index.js
│   │   │   ├── topologicalSort.js
│   │   │   ├── asapScheduler.js
│   │   │   ├── leveledScheduler.js
│   │   │   └── conflictDetector.js
│   │   └── hooks/
│   │       ├── useAutoScheduleRun.js
│   │       ├── useConflicts.js
│   │       └── useScheduledTasks.js
│   │
│   ├── materials/
│   │   ├── requirements/
│   │   │   ├── RequirementsList.jsx
│   │   │   └── RequirementsFilters.jsx
│   │   ├── shortages/
│   │   │   └── ShortageAlert.jsx
│   │   ├── catalog/
│   │   │   ├── MaterialCatalog.jsx
│   │   │   └── MaterialForm.jsx
│   │   ├── procurement/
│   │   │   ├── POList.jsx
│   │   │   ├── PODetail.jsx
│   │   │   ├── POForm.jsx
│   │   │   └── ReceiptEntry.jsx
│   │   └── hooks/
│   │       ├── useMaterialRequirements.js
│   │       ├── useShortages.js
│   │       ├── useMaterials.js
│   │       └── usePOs.js
│   │
│   ├── dashboards/
│   │   ├── DashboardShell.jsx
│   │   ├── ExecutiveDashboard.jsx
│   │   ├── SalesDashboard.jsx
│   │   ├── ProductionDashboard.jsx
│   │   ├── CapacityDashboard.jsx
│   │   ├── OTDDashboard.jsx
│   │   └── charts/
│   │       ├── BarChart.jsx
│   │       ├── HorizontalBar.jsx
│   │       ├── FunnelChart.jsx
│   │       ├── SparkLine.jsx
│   │       └── HeatGrid.jsx
│   │
│   ├── ai-intake/
│   │   ├── IntakeInbox.jsx
│   │   ├── IntakeDraftReview.jsx
│   │   ├── ParsedDraftForm.jsx
│   │   ├── IntakeUpload.jsx
│   │   └── hooks/
│   │       ├── useIntakeDrafts.js
│   │       └── useParseDocument.js
│   │
│   └── integrations/
│       ├── SyncLogViewer.jsx
│       ├── WebhookEventList.jsx
│       ├── netsuite/
│       │   ├── NetSuitePanel.jsx
│       │   └── NetSuiteSyncControls.jsx
│       ├── procore/
│       │   └── ProcorePanel.jsx
│       ├── excel/
│       │   └── ExcelSyncPanel.jsx
│       └── hooks/
│           ├── useSyncLog.js
│           ├── useWebhookEvents.js
│           └── useNetSuiteSync.js
│
└── utils/
    ├── dates.js           ← existing date helpers extracted
    ├── formatters.js      ← currency, number, % formatters
    ├── normalizeJob.js    ← EXISTING normalizeJob()
    ├── readiness.js       ← EXISTING readinessScore()
    └── constants.js       ← stage defs, status lists, line IDs
```

---

## Key Architectural Decisions

**1. Preserve, don't refactor, the existing scheduler.** `ProductionScheduler.jsx`, `DispatchBoard.jsx`, `PipelineKanban.jsx`, `useJobs`, `usePipelineDeals`, `JobFactSheet`, and all existing hooks are mounted as-is inside the new shell. The new `AppShell` replaces the internal nav by reading `activeModule` from the URL instead of component state, but the scheduler's internal state machine is untouched.

**2. React Query as the single server-state layer.** No Redux, no additional Zustand slices for server data. Zustand is used only for truly global UI state (auth, sidebar, toasts, feature flags). React Query's cache acts as the in-memory database for all fetched data; cross-module coordination happens via `queryClient.invalidateQueries()`.

**3. Supabase edge functions for all external API calls.** NetSuite, AI parsing, and Procore sync all run in edge functions. This keeps API credentials out of the browser, enables server-side retry logic, and allows calling external APIs without CORS restrictions.

**4. The scheduling engine runs in the browser.** At the scale of this business (~100-300 jobs, ~15 routing steps each), a browser-side topological sort + constraint solver is fast enough (sub-100ms). This avoids a separate compute service and lets the UI immediately show the diff before any DB writes. On confirmation, a single bulk upsert writes all proposed dates.

**5. The `external_id_map` table is the integration source of truth.** Components never store NetSuite/Procore IDs directly in their local state — they call `fetchExternalIds()` when needed. This makes the integration layer a clean seam: swap the external system without touching any production, CRM, or quoting component.

**6. CSS-only charts.** No chart library (Chart.js, Recharts, Victory) is added. The existing app uses raw SVG/CSS for its Gantt bars and utilization displays. Extending that pattern keeps the bundle small and the visual language consistent with the `ps-*` design system already in place.