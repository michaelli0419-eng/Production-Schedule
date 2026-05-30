import { useMemo } from "react";
import { mockProductionJobs, getReleaseGateIssues } from "../scheduler/mockData";

export default function ProductionJobsPage() {
  const rows = useMemo(() => mockProductionJobs.map((job) => ({ ...job, gateIssues: getReleaseGateIssues(job) })), []);

  return (
    <section className="ps-panel" style={{ padding: 16 }}>
      <h2>Production Jobs</h2>
      <p style={{ marginBottom: 12 }}>Jobs are the control object. Scheduler only places routed scheduled tasks.</p>
      <div className="ps-risk-list">
        {rows.map((job) => (
          <div key={job.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <strong>{job.jobNumber} - {job.customerName}</strong>
            <div>Revenue: ${job.revenue.toLocaleString()} | Margin: {(job.margin * 100).toFixed(1)}% | Qty: {job.quantity}</div>
            <div>Status: {job.status} | Due: {job.dueDate}</div>
            {job.gateIssues.length > 0 && <div style={{ color: "#b91c1c" }}>Blocked by: {job.gateIssues.join(", ")}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
