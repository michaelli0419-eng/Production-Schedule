import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import SearchInput from "../../../components/ui/SearchInput.jsx";
import Select from "../../../components/ui/Select.jsx";
import DataTable from "../../../components/ui/DataTable.jsx";
import StatusChip from "../../../components/ui/StatusChip.jsx";
import SlideOver from "../../../components/ui/SlideOver.jsx";
import SectionHeader from "../../../components/ui/SectionHeader.jsx";
import {
  useOpportunitiesByStage,
  useOpportunities,
  useMoveOpportunityStage,
} from "../hooks/useOpportunities.js";
import OpportunityForm from "./OpportunityForm.jsx";

const OPP_STAGES = [
  { id: "lead",        label: "Lead",         probability: 10, color: "#6b7280" },
  { id: "qualify",     label: "Qualify",      probability: 20, color: "#3b82f6" },
  { id: "estimate",    label: "Estimate",     probability: 35, color: "#8b5cf6" },
  { id: "proposal",    label: "Proposal",     probability: 55, color: "#f59e0b" },
  { id: "negotiation", label: "Negotiation",  probability: 70, color: "#f97316" },
  { id: "award",       label: "Award",        probability: 85, color: "#10b981" },
];

const ALL_STAGES = [
  ...OPP_STAGES,
  { id: "handoff", label: "Handoff",  probability: 95, color: "#06b6d4" },
  { id: "lost",    label: "Lost",     probability: 0,  color: "#ef4444" },
  { id: "dead",    label: "Dead",     probability: 0,  color: "#9ca3af" },
];

function money(v) {
  if (!v && v !== 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function getStageColor(stageId) {
  return ALL_STAGES.find((s) => s.id === stageId)?.color ?? "#6b7280";
}

function getStageLabel(stageId) {
  return ALL_STAGES.find((s) => s.id === stageId)?.label ?? stageId;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Pipeline summary strip ───────────────────────────────────────────────────
function PipelineSummary({ kanban }) {
  const totalWeighted = OPP_STAGES.reduce((sum, s) => {
    const list = kanban?.[s.id] ?? [];
    return (
      sum +
      list.reduce(
        (a, o) => a + (o.contract_value ?? 0) * ((o.probability ?? 0) / 100),
        0
      )
    );
  }, 0);

  const totalContract = OPP_STAGES.reduce((sum, s) => {
    const list = kanban?.[s.id] ?? [];
    return sum + list.reduce((a, o) => a + (o.contract_value ?? 0), 0);
  }, 0);

  const totalCount = OPP_STAGES.reduce(
    (n, s) => n + (kanban?.[s.id]?.length ?? 0),
    0
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        padding: "10px 16px",
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        marginBottom: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div>
        <span style={{ fontSize: "0.72rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Active Opps
        </span>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>{totalCount}</div>
      </div>
      <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch" }} />
      <div>
        <span style={{ fontSize: "0.72rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pipeline Value
        </span>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>{money(totalContract)}</div>
      </div>
      <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch" }} />
      <div>
        <span style={{ fontSize: "0.72rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Weighted Value
        </span>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#059669" }}>{money(totalWeighted)}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 12, flexWrap: "wrap" }}>
        {OPP_STAGES.map((s) => {
          const count = kanban?.[s.id]?.length ?? 0;
          return (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#374151" }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: "#111827" }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kanban card ──────────────────────────────────────────────────────────────
function OppCard({ opp, onDragStart, navigate }) {
  const color = getStageColor(opp.stage);
  const dragEnabled = !String(opp.id || "").startsWith("deal:");

  return (
    <div
      draggable={dragEnabled}
      onDragStart={(e) => dragEnabled && onDragStart(e, opp.id, opp.stage)}
      onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        marginBottom: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
    >
      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827", marginBottom: 3, lineHeight: 1.3 }}>
        {opp.opportunity_name || "Unnamed Opportunity"}
      </div>
      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 6 }}>
        {opp.company_name || opp.company_id || "—"}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
          {money(opp.contract_value)}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 999,
            background: color + "22",
            color,
            border: `1px solid ${color}55`,
          }}
        >
          {opp.probability ?? 0}%
        </span>
      </div>

      {opp.expected_occupancy_date && (
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 4 }}>
          Close: {fmtDate(opp.expected_occupancy_date)}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
          {opp.opp_number ? `#${opp.opp_number}` : ""}
        </span>
        {!dragEnabled && (
          <span style={{ fontSize: "0.66rem", color: "#64748b", fontWeight: 700 }}>
            Pipeline-linked
          </span>
        )}
        {opp.bdm_name && (
          <span
            title={opp.bdm_name}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#e0e7ff",
              color: "#3730a3",
              fontSize: "0.65rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials(opp.bdm_name)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Kanban board ─────────────────────────────────────────────────────────────
function KanbanBoard({ kanban, moveStage }) {
  const navigate = useNavigate();
  const dragRef = useRef({ id: null, fromStage: null });
  const [dragOverStage, setDragOverStage] = useState(null);

  function onDragStart(e, id, fromStage) {
    dragRef.current = { id, fromStage };
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e, stageId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  }

  function onDragLeave() {
    setDragOverStage(null);
  }

  function onDrop(e, toStage) {
    e.preventDefault();
    setDragOverStage(null);
    const { id, fromStage } = dragRef.current;
    if (!id || fromStage === toStage) return;
    moveStage.mutate({ id, fromStage, toStage });
    dragRef.current = { id: null, fromStage: null };
  }

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
      {OPP_STAGES.map((stage) => {
        const items = kanban?.[stage.id] ?? [];
        const colTotal = items.reduce((s, o) => s + (o.contract_value ?? 0), 0);
        const isDragOver = dragOverStage === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => onDragOver(e, stage.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, stage.id)}
            style={{
              minWidth: 240,
              maxWidth: 260,
              flex: "0 0 250px",
              background: isDragOver ? "#f0fdf4" : "#f8fafc",
              border: `2px solid ${isDragOver ? stage.color : "#e5e7eb"}`,
              borderTop: `3px solid ${stage.color}`,
              borderRadius: 8,
              padding: "10px 8px 8px",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            {/* Column header */}
            <div style={{ marginBottom: 10, padding: "0 4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#374151" }}>
                  {stage.label}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    background: stage.color + "22",
                    color: stage.color,
                    borderRadius: 999,
                    padding: "0 7px",
                    lineHeight: "18px",
                  }}
                >
                  {items.length}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>
                {money(colTotal)}
              </div>
            </div>

            {/* Cards */}
            {items.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  color: "#d1d5db",
                  padding: "20px 8px",
                  border: "1px dashed #e5e7eb",
                  borderRadius: 6,
                }}
              >
                Drop deals here
              </div>
            ) : (
              items.map((opp) => (
                <OppCard
                  key={opp.id}
                  opp={opp}
                  onDragStart={onDragStart}
                  navigate={navigate}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────────────────
function ListView({ search, setSearch, stageFilter, setStageFilter, bdmFilter, setBdmFilter }) {
  const navigate = useNavigate();

  const { opportunities, isLoading } = useOpportunities({
    search: search || undefined,
    stage: stageFilter || undefined,
    bdm: bdmFilter || undefined,
  });

  const columns = [
    { key: "opp_number", label: "Opp #", width: 80, sortable: true, render: (v) => v ? `#${v}` : "—" },
    {
      key: "opportunity_name",
      label: "Name",
      sortable: true,
      render: (v) => <span style={{ fontWeight: 600, color: "#111827" }}>{v || "—"}</span>,
    },
    { key: "company_name", label: "Company", sortable: true, render: (v) => v || "—" },
    {
      key: "stage",
      label: "Stage",
      width: 130,
      render: (v) => (
        <StatusChip
          status={v}
          label={getStageLabel(v)}
          size="sm"
        />
      ),
    },
    {
      key: "contract_value",
      label: "Contract Value",
      sortable: true,
      width: 130,
      render: (v) => <span style={{ fontFamily: "monospace" }}>{money(v)}</span>,
    },
    {
      key: "probability",
      label: "Prob.",
      width: 70,
      render: (v) => `${v ?? 0}%`,
    },
    {
      key: "expected_occupancy_date",
      label: "Close Date",
      sortable: true,
      width: 110,
      render: (v) => fmtDate(v),
    },
    { key: "bdm_name", label: "BDM", width: 120, render: (v) => v || "—" },
    { key: "pm_name", label: "PM", width: 120, render: (v) => v || "—" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search opportunities..."
          />
        </div>
        <div style={{ width: 150 }}>
          <Select
            value={stageFilter}
            onChange={setStageFilter}
            placeholder="All Stages"
            clearable
            options={ALL_STAGES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </div>
        <div style={{ width: 150 }}>
          <Select
            value={bdmFilter}
            onChange={setBdmFilter}
            placeholder="All BDMs"
            clearable
            options={[]}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={opportunities}
        loading={isLoading}
        emptyText="No opportunities found."
        onRowClick={(row) => navigate(`/crm/opportunities/${row.id}`)}
      />
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function OpportunityList() {
  const [view, setView] = useState("kanban");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [bdmFilter, setBdmFilter] = useState("");

  const { kanban, isLoading } = useOpportunitiesByStage();
  const moveStage = useMoveOpportunityStage();

  return (
    <div style={{ padding: "24px 28px" }}>
      <SectionHeader
        title="Opportunities"
        subtitle="Manage your sales pipeline"
        actions={
          <>
            <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
              <button
                onClick={() => setView("kanban")}
                style={{
                  padding: "5px 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  background: view === "kanban" ? "#111827" : "#fff",
                  color: view === "kanban" ? "#fff" : "#374151",
                  border: "none",
                  cursor: "pointer",
                  borderRight: "1px solid #e5e7eb",
                }}
              >
                Board
              </button>
              <button
                onClick={() => setView("list")}
                style={{
                  padding: "5px 14px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  background: view === "list" ? "#111827" : "#fff",
                  color: view === "list" ? "#fff" : "#374151",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                List
              </button>
            </div>
            <Button onClick={() => setShowForm(true)} size="sm">
              + New Opportunity
            </Button>
          </>
        }
      />

      {isLoading && view === "kanban" ? (
        <div style={{ color: "#6b7280", padding: 32, textAlign: "center" }}>Loading pipeline...</div>
      ) : view === "kanban" ? (
        <>
          <PipelineSummary kanban={kanban} />
          <KanbanBoard kanban={kanban} moveStage={moveStage} />
        </>
      ) : (
        <ListView
          search={search}
          setSearch={setSearch}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          bdmFilter={bdmFilter}
          setBdmFilter={setBdmFilter}
        />
      )}

      <SlideOver
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Opportunity"
        size="lg"
      >
        <OpportunityForm
          opportunity={null}
          onSuccess={() => setShowForm(false)}
          onClose={() => setShowForm(false)}
        />
      </SlideOver>
    </div>
  );
}
