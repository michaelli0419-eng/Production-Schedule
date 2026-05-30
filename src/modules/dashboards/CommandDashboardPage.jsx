import { useMemo } from "react";
import { mockProductionJobs } from "../scheduler/mockData";

export default function CommandDashboardPage() {
  const metrics = useMemo(() => {
    const blocked = mockProductionJobs.filter((j) => j.status === "BLOCKED").length;
    return {
      backlog: mockProductionJobs.length,
      blocked,
      active: mockProductionJobs.filter((j) => j.status === "READY" || j.status === "IN_PRODUCTION").length,
    };
  }, []);

  return (
    <section className="ps-kpis" style={{ marginTop: 0 }}>
      <article className="ps-kpi"><span>Production Backlog</span><strong>{metrics.backlog}</strong><small>Total jobs</small></article>
      <article className="ps-kpi ps-kpi-amber"><span>Blocked Jobs</span><strong>{metrics.blocked}</strong><small>Release gate issues</small></article>
      <article className="ps-kpi ps-kpi-green"><span>Active Production Jobs</span><strong>{metrics.active}</strong><small>Ready or in progress</small></article>
      <article className="ps-kpi"><span>Weekly Factory Utilization</span><strong>74%</strong><small>Capacity forecast baseline</small></article>
    </section>
  );
}
