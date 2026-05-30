import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MetricCard from "../../components/ui/MetricCard.jsx";
import { fetchCrmDashboardMetrics } from "../../lib/crmApi.js";

const STAGES = ["lead", "qualify", "estimate", "proposal", "negotiation", "award"];

const STAGE_COLORS = {
  lead: "#6366f1",
  qualify: "#3b82f6",
  estimate: "#f59e0b",
  proposal: "#10b981",
  negotiation: "#f97316",
  award: "#22c55e",
};

const STAGE_LABELS = {
  lead: "Lead",
  qualify: "Qualify",
  estimate: "Estimate",
  proposal: "Proposal",
  negotiation: "Negotiation",
  award: "Award",
};

function fmt$(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function Shimmer({ width = "100%", height = 36, borderRadius = 8 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Metric cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} height={100} />
        ))}
      </div>
      {/* Pipeline by stage */}
      <Shimmer height={220} />
      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <Shimmer height={80} />
        <Shimmer height={180} />
      </div>
    </div>
  );
}

function PipelineByStage({ stageBreakdown }) {
  const stageData = STAGES.map((s) => {
    const found = stageBreakdown.find((b) => b.stage === s);
    return { stage: s, count: found?.count ?? 0, value: found?.value ?? 0 };
  });

  const maxValue = Math.max(...stageData.map((s) => s.value), 1);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "20px 24px",
      }}
    >
      <h3 style={{ margin: "0 0 16px", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
        Pipeline by Stage
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stageData.map(({ stage, count, value }) => {
          const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 90, fontSize: "0.78rem", color: "#6b7280", fontWeight: 500, flexShrink: 0 }}>
                {STAGE_LABELS[stage]}
              </div>
              <div style={{ flex: 1, position: "relative", height: 28, backgroundColor: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: STAGE_COLORS[stage] || "#6b7280",
                    borderRadius: 6,
                    transition: "width 0.4s ease",
                    minWidth: count > 0 ? 4 : 0,
                  }}
                />
              </div>
              <div style={{ width: 36, textAlign: "right", fontSize: "0.78rem", fontWeight: 600, color: "#374151", flexShrink: 0 }}>
                {count}
              </div>
              <div style={{ width: 72, textAlign: "right", fontSize: "0.78rem", color: "#6b7280", flexShrink: 0 }}>
                {value > 0 ? fmt$(value) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitiesCard({ count }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
        Activities This Week
      </h3>
      <div style={{ fontSize: "2.4rem", fontWeight: 700, color: "#111827", lineHeight: 1 }}>
        {count}
      </div>
      <a
        href="#crm/activities"
        style={{ fontSize: "0.8rem", color: "#3b82f6", textDecoration: "none", fontWeight: 500 }}
      >
        View all &rarr;
      </a>
    </div>
  );
}

function BdmTable({ dealsByBdm }) {
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "20px 24px",
      }}
    >
      <h3 style={{ margin: "0 0 14px", fontSize: "0.9rem", fontWeight: 600, color: "#374151" }}>
        Pipeline by BDM
      </h3>
      {dealsByBdm.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af" }}>No data available.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "6px 8px 8px 0", color: "#6b7280", fontWeight: 600 }}>BDM</th>
              <th style={{ textAlign: "right", padding: "6px 8px 8px", color: "#6b7280", fontWeight: 600 }}>Deals</th>
              <th style={{ textAlign: "right", padding: "6px 8px 8px", color: "#6b7280", fontWeight: 600 }}>Total Value</th>
              <th style={{ textAlign: "right", padding: "6px 0 8px 8px", color: "#6b7280", fontWeight: 600 }}>Weighted</th>
            </tr>
          </thead>
          <tbody>
            {dealsByBdm.map((row) => {
              const weighted = row.weighted_value ?? row.value * 0.4;
              return (
                <tr key={row.bdm_name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "7px 8px 7px 0", color: "#111827", fontWeight: 500 }}>{row.bdm_name}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "#374151" }}>{row.count}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: "#374151" }}>{fmt$(row.value)}</td>
                  <td style={{ padding: "7px 0 7px 8px", textAlign: "right", color: "#6b7280" }}>{fmt$(weighted)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CrmDashboard() {
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm_dashboard", yearFilter],
    queryFn: () => fetchCrmDashboardMetrics({ year: yearFilter }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 10,
          color: "#991b1b",
          fontSize: "0.875rem",
        }}
      >
        Failed to load CRM dashboard: {error.message}
      </div>
    );
  }

  const {
    availableYears = [],
    totalPipelineValue = 0,
    weightedValue = 0,
    winRate = 0,
    openTasks = 0,
    stageBreakdown = [],
    activitiesThisWeek = 0,
    dealsByBdm = [],
  } = data ?? {};

  const yearOptions = useMemo(() => {
    const values = new Set([currentYear, ...availableYears]);
    return ["all", ...[...values].sort((a, b) => b - a).map((y) => String(y))];
  }, [availableYears, currentYear]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        <label htmlFor="crm-year-filter" style={{ fontSize: 13, color: "#4b5563", fontWeight: 600 }}>
          Timeline
        </label>
        <select
          id="crm-year-filter"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "6px 10px",
            background: "#fff",
            color: "#111827",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y === "all" ? "All Years" : `${y} Pipeline`}
            </option>
          ))}
        </select>
      </div>

      {/* Top row: 4 metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <MetricCard
          label="Total Pipeline"
          value={fmt$(totalPipelineValue)}
          color="blue"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="7" width="3" height="7" rx="1" fill="currentColor" opacity="0.5" />
              <rect x="6.5" y="4" width="3" height="10" rx="1" fill="currentColor" opacity="0.75" />
              <rect x="11" y="1" width="3" height="13" rx="1" fill="currentColor" />
            </svg>
          }
        />
        <MetricCard
          label="Weighted Pipeline"
          value={fmt$(weightedValue)}
          color="purple"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <MetricCard
          label="Win Rate"
          value={`${winRate}%`}
          color="green"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 9l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <MetricCard
          label="Open Tasks"
          value={openTasks.toLocaleString()}
          color="amber"
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/* Pipeline by stage */}
      <PipelineByStage stageBreakdown={stageBreakdown} />

      {/* Activities + BDM table */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
        <ActivitiesCard count={activitiesThisWeek} />
        <BdmTable dealsByBdm={dealsByBdm} />
      </div>
    </div>
  );
}
