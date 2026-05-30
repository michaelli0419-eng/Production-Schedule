import { useEffect, useRef, useState } from "react";

const STAGES = [
  { id: "lead",     label: "Lead",             probability: 15, color: "#64748b" },
  { id: "estimate", label: "Estimating",        probability: 35, color: "#0891b2" },
  { id: "proposal", label: "Proposal",          probability: 55, color: "#7c3aed" },
  { id: "award",    label: "Verbal Award",      probability: 80, color: "#d97706" },
  { id: "handoff",  label: "Contract Handoff",  probability: 95, color: "#059669" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  return MONTHS[d.getMonth()] + " '" + String(d.getFullYear()).slice(2);
}

function money(v) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function safeMoney(v, canView) {
  return canView ? money(v) : "Locked";
}

function newDeal() {
  return {
    id: `deal-${Date.now()}`,
    opportunityName: "",
    client: "",
    stage: "lead",
    probability: 15,
    amount: 0,
    weightedAmount: 0,
    prodStartDate: "",
    expectedCloseDate: "",
    bdm: "",
    estimator: "",
    projectManager: "",
    buildingType: "",
    modules: 0,
    notes: "",
  };
}

export default function PipelineKanban({ deals, setDeals, onAddJobFromDeal, canViewPrices, onOpenJobRecord }) {
  const [panelDeal, setPanelDeal] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const dragId = useRef(null);

  // ── Drag & Drop ─────────────────────────────────────────────────────
  function onDragStart(e, dealId) {
    dragId.current = dealId;
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e, stageId) {
    e.preventDefault();
    if (!dragId.current) return;
    const id = dragId.current;
    dragId.current = null;
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const stage = STAGES.find((s) => s.id === stageId);
        const prob = stage?.probability ?? d.probability;
        return {
          ...d,
          stage: stageId,
          probability: prob,
          weightedAmount: Math.round((Number(d.amount) || 0) * (prob / 100)),
        };
      })
    );
  }

  // ── Panel helpers ────────────────────────────────────────────────────
  function openDeal(deal) {
    setPanelDeal({ ...deal });
    setIsNew(false);
  }

  function openNew() {
    setPanelDeal(newDeal());
    setIsNew(true);
  }

  function closePanel() {
    setPanelDeal(null);
  }

  function saveDeal() {
    if (!panelDeal) return;
    const weighted = Math.round((Number(panelDeal.amount) || 0) * ((Number(panelDeal.probability) || 0) / 100));
    const updated = { ...panelDeal, weightedAmount: weighted };
    if (isNew) {
      setDeals((prev) => [...prev, updated]);
    } else {
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
    closePanel();
  }

  function deleteDeal() {
    if (!panelDeal) return;
    setDeals((prev) => prev.filter((d) => d.id !== panelDeal.id));
    closePanel();
  }

  function updateField(key, value) {
    setPanelDeal((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "amount" || key === "probability") {
        next.weightedAmount = Math.round(
          (Number(key === "amount" ? value : prev.amount) || 0) *
          ((Number(key === "probability" ? value : prev.probability) || 0) / 100)
        );
      }
      if (key === "stage") {
        const stage = STAGES.find((s) => s.id === value);
        if (stage) {
          next.probability = stage.probability;
          next.weightedAmount = Math.round((Number(prev.amount) || 0) * (stage.probability / 100));
        }
      }
      return next;
    });
  }

  // ── Filtered deals ───────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q
    ? deals.filter((d) =>
        [d.opportunityName, d.client, d.bdm, d.estimator, d.projectManager, d.buildingType, d.notes]
          .join(" ").toLowerCase().includes(q)
      )
    : deals;

  // ── Revenue forecast bars ────────────────────────────────────────────
  const monthBuckets = {};
  deals.forEach((d) => {
    if (!d.expectedCloseDate) return;
    const dt = new Date(d.expectedCloseDate + "T00:00:00");
    if (isNaN(dt)) return;
    const key = `${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
    monthBuckets[key] = (monthBuckets[key] || 0) + (Number(d.weightedAmount) || 0);
  });
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const forecastEntries = Object.entries(monthBuckets)
    .sort(([a], [b]) => {
      const [aMon, aYr] = a.split(" ");
      const [bMon, bYr] = b.split(" ");
      return (Number(aYr) - Number(bYr)) || (MONTHS.indexOf(aMon) - MONTHS.indexOf(bMon));
    });
  const curMonthKey = `${MONTHS[curMonth]} ${curYear}`;
  const curMonthIdx = forecastEntries.findIndex(([k]) => k === curMonthKey);
  const forecastScrollRef = useRef(null);

  useEffect(() => {
    if (!forecastScrollRef.current || curMonthIdx < 0) return;
    const bars = forecastScrollRef.current.querySelectorAll(".pk-forecast-bar");
    const target = bars[Math.max(0, curMonthIdx - 6)];
    if (target) target.scrollIntoView({ behavior: "instant", block: "nearest", inline: "start" });
  }, [curMonthIdx]);

  // drag-to-scroll
  useEffect(() => {
    const el = forecastScrollRef.current;
    if (!el) return;
    let isDown = false, startX = 0, scrollLeft = 0;
    const onDown = (e) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; };
    const onUp = () => { isDown = false; };
    const onMove = (e) => { if (!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX); };
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onUp);
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onUp);
      el.removeEventListener("mousemove", onMove);
    };
  }, []);
  const maxForecast = Math.max(1, ...forecastEntries.map(([, v]) => v));

  const totalPipeline = deals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const totalWeighted = deals.reduce((s, d) => s + (Number(d.weightedAmount) || 0), 0);

  return (
    <div className="pk-root">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="pk-toolbar">
        <input
          className="pk-search"
          type="search"
          placeholder="Search project, customer, BDM, building type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="pk-totals">
          <span>Pipeline: <strong>{safeMoney(totalPipeline, canViewPrices)}</strong></span>
          <span>Weighted: <strong>{safeMoney(totalWeighted, canViewPrices)}</strong></span>
          <span>{deals.length} opportunities</span>
        </div>
        <button type="button" className="pk-add-btn" onClick={openNew}>+ New Deal</button>
      </div>

      {/* ── Revenue forecast ─────────────────────────────────────────── */}
      {forecastEntries.length > 0 && (
        <div className="pk-forecast">
          <span className="pk-forecast-label">Weighted close forecast</span>
          <div className="pk-forecast-bars" ref={forecastScrollRef}>
            {forecastEntries.map(([label, val]) => (
              <div key={label} className="pk-forecast-bar">
                <div className="pk-forecast-fill" style={{ height: `${Math.round((val / maxForecast) * 100)}%` }} />
                <span className="pk-forecast-val">{canViewPrices ? money(val) : "—"}</span>
                <span className="pk-forecast-month">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Kanban board ─────────────────────────────────────────────── */}
      <div className="pk-board">
        {STAGES.map((stage) => {
          const stageDeals = filtered.filter((d) => d.stage === stage.id);
          const stageWeighted = stageDeals.reduce((s, d) => s + (Number(d.weightedAmount) || 0), 0);

          return (
            <div
              key={stage.id}
              className="pk-column"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, stage.id)}
            >
              <div className="pk-col-head" style={{ borderTopColor: stage.color }}>
                <strong>{stage.label}</strong>
                <span>{stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""}</span>
                <em>{safeMoney(stageWeighted, canViewPrices)}</em>
              </div>

              {stageDeals.map((deal) => {
                const bdmLabel = deal.bdm || deal.estimator || null;
                const isConverted = Boolean(deal.convertedJobId || deal.convertedAt);
                const prodMo  = fmtMonth(deal.prodStartDate);
                const closeMo = fmtMonth(deal.expectedCloseDate);
                const dateRange = prodMo && closeMo && prodMo !== closeMo
                  ? `${prodMo} → ${closeMo}`
                  : prodMo || closeMo || null;
                return (
                  <div
                    key={deal.id}
                    className={`pk-card${isConverted ? " pk-card-converted" : ""}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, deal.id)}
                    onClick={() => openDeal(deal)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openDeal(deal)}
                  >
                    <div className="pk-card-name">
                      {deal.opportunityName || "(unnamed)"}
                      {isConverted && <span className="pk-converted-badge">Converted</span>}
                    </div>
                    <div className="pk-card-client">{deal.client || "—"}</div>
                    {bdmLabel && (
                      <div className="pk-card-bdm">{bdmLabel}</div>
                    )}
                    <div className="pk-card-meta">
                      <span>{deal.buildingType || "—"}</span>
                      {dateRange && <span className="pk-card-dates">{dateRange}</span>}
                    </div>
                    <div className="pk-card-footer">
                      <strong>{safeMoney(Number(deal.amount) || 0, canViewPrices)}</strong>
                      <span>{deal.probability}%</span>
                    </div>
                    {(stage.id === "award" || stage.id === "handoff") && !isConverted && onAddJobFromDeal && (
                      <button
                        type="button"
                        className="pk-convert-btn"
                        title="Convert to production job"
                        onClick={(e) => { e.stopPropagation(); onAddJobFromDeal(deal); }}
                      >
                        + Convert to Job
                      </button>
                    )}
                  </div>
                );
              })}

              {stageDeals.length === 0 && (
                <div className="pk-empty-col">Drop deals here</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Side panel overlay ───────────────────────────────────────── */}
      {panelDeal && (
        <div className="pk-overlay" onClick={closePanel}>
          <aside className="pk-panel" onClick={(e) => e.stopPropagation()} aria-label="Deal details">
            <div className="pk-panel-head">
              <h2>{isNew ? "New Deal" : (panelDeal.opportunityName || "Deal Details")}</h2>
              <button type="button" className="pk-panel-close" onClick={closePanel} aria-label="Close">✕</button>
            </div>

            <div className="pk-panel-body">
              {/* Converted notice */}
              {!isNew && (panelDeal.convertedJobId || panelDeal.convertedAt) && (
                <div className="pk-converted-notice">
                  <span>
                    Converted to job
                    {panelDeal.convertedAt ? ` on ${panelDeal.convertedAt.slice(0, 10)}` : ""}
                  </span>
                  {panelDeal.convertedJobId && onOpenJobRecord && (
                    <button
                      type="button"
                      className="pk-open-record-btn"
                      onClick={() => { closePanel(); onOpenJobRecord(panelDeal.convertedJobId); }}
                    >
                      Open Job Record →
                    </button>
                  )}
                </div>
              )}

              <div className="pk-field-group">
                <label className="pk-label">Project Name
                  <input className="pk-input" value={panelDeal.opportunityName || ""} onChange={(e) => updateField("opportunityName", e.target.value)} />
                </label>
                <label className="pk-label">Customer
                  <input className="pk-input" value={panelDeal.client || ""} onChange={(e) => updateField("client", e.target.value)} />
                </label>
              </div>

              <div className="pk-field-group">
                <label className="pk-label">Stage
                  <select className="pk-input" value={panelDeal.stage} onChange={(e) => updateField("stage", e.target.value)}>
                    {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <label className="pk-label">Probability (%)
                  <input className="pk-input" type="number" min="0" max="100" value={panelDeal.probability} onChange={(e) => updateField("probability", e.target.value)} />
                </label>
              </div>

              <div className="pk-field-group">
                <label className="pk-label">Contract Value
                  <input className="pk-input" type="number" min="0" value={panelDeal.amount} onChange={(e) => updateField("amount", e.target.value)} />
                </label>
                <label className="pk-label">Weighted Value
                  <input className="pk-input" value={money(panelDeal.weightedAmount || 0)} readOnly tabIndex={-1} style={{ background: "#f8fafc", color: "#059669", fontWeight: 700 }} />
                </label>
              </div>

              <div className="pk-field-group">
                <label className="pk-label">Production Start
                  <input className="pk-input" type="date" value={panelDeal.prodStartDate || ""} onChange={(e) => updateField("prodStartDate", e.target.value)} />
                </label>
                <label className="pk-label">District Occupancy
                  <input className="pk-input" type="date" value={panelDeal.expectedCloseDate || ""} onChange={(e) => updateField("expectedCloseDate", e.target.value)} />
                </label>
              </div>

              <div className="pk-field-group">
                <label className="pk-label">Building Type
                  <input className="pk-input" value={panelDeal.buildingType || ""} onChange={(e) => updateField("buildingType", e.target.value)} />
                </label>
                <label className="pk-label">Modules
                  <input className="pk-input" type="number" min="0" value={panelDeal.modules || 0} onChange={(e) => updateField("modules", e.target.value)} />
                </label>
                <label className="pk-label">BDM
                  <input className="pk-input" value={panelDeal.bdm || ""} onChange={(e) => updateField("bdm", e.target.value)} />
                </label>
              </div>

              <div className="pk-field-group">
                <label className="pk-label">Estimator
                  <input className="pk-input" value={panelDeal.estimator || ""} onChange={(e) => updateField("estimator", e.target.value)} />
                </label>
                <label className="pk-label">Project Manager
                  <input className="pk-input" value={panelDeal.projectManager || ""} onChange={(e) => updateField("projectManager", e.target.value)} />
                </label>
              </div>

              <label className="pk-label pk-label-full">Notes
                <textarea className="pk-input pk-textarea" value={panelDeal.notes || ""} onChange={(e) => updateField("notes", e.target.value)} rows={4} />
              </label>

              {/* Read-only meta */}
              {!isNew && (panelDeal.sourceType || panelDeal.sourceSheet) && (
                <div className="pk-meta-row">
                  <span>Source: {[panelDeal.sourceType, panelDeal.sourceSheet].filter(Boolean).join(" · ")}</span>
                </div>
              )}
            </div>

            <div className="pk-panel-foot">
              {!isNew && (
                <button type="button" className="pk-btn-danger" onClick={deleteDeal}>Delete</button>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className="pk-btn-ghost" onClick={closePanel}>Cancel</button>
              <button type="button" className="pk-btn-primary" onClick={saveDeal}>
                {isNew ? "Create Deal" : "Save Changes"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
