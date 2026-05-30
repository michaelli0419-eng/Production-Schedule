export const mockProductionJobs = [
  {
    id: "PJ-1001",
    jobNumber: "SCM-2401",
    customerName: "Los Angeles USD",
    opportunityId: "OPP-101",
    quoteId: "Q-101",
    estimatingBomId: "BOM-101-R2",
    salesOrderRef: { netsuiteSalesOrderId: "SO-55021", syncStatus: "SYNCED", lastSyncedAt: "2026-05-28T15:00:00.000Z" },
    procoreRef: { procoreProjectId: "PC-882", syncStatus: "SYNCED" },
    revenue: 4100000,
    margin: 0.22,
    quantity: 28,
    dueDate: "2026-08-15",
    priority: "HIGH",
    routingTemplateId: "RT-FAB-ENG",
    materialReadinessStatus: "READY",
    engineeringReleaseStatus: "RELEASED",
    productionReleaseStatus: "RELEASED",
    quoteApproved: true,
    estimatingBomApproved: true,
    drawingsReleased: true,
    blockers: [],
    status: "READY",
  },
  {
    id: "PJ-1002",
    jobNumber: "SCM-2402",
    customerName: "Fresno USD",
    opportunityId: "OPP-102",
    quoteId: "Q-102",
    estimatingBomId: "BOM-102-R1",
    salesOrderRef: null,
    procoreRef: { procoreProjectId: "PC-883", syncStatus: "SYNCED" },
    revenue: 3600000,
    margin: 0.19,
    quantity: 24,
    dueDate: "2026-09-10",
    priority: "CRITICAL",
    routingTemplateId: "RT-FAB-ENG",
    materialReadinessStatus: "NOT_READY",
    engineeringReleaseStatus: "PENDING",
    productionReleaseStatus: "PENDING",
    quoteApproved: true,
    estimatingBomApproved: false,
    drawingsReleased: false,
    blockers: [
      { id: "BLK-1002-1", productionJobId: "PJ-1002", code: "MISSING_SO", reason: "Missing NetSuite sales order reference", canOverride: true },
      { id: "BLK-1002-2", productionJobId: "PJ-1002", code: "BOM_NOT_APPROVED", reason: "Estimating BOM not approved", canOverride: false },
    ],
    status: "BLOCKED",
  },
];

export const mockRoutingSteps = [
  { id: "RS-ENG-1", routingTemplateId: "RT-FAB-ENG", name: "Engineering Release", departmentId: "DEPT-ENG", workCenterId: "WC-ENG", requiredRole: "Engineer", estimatedDurationHours: 8, setupHours: 1, dependencyStepIds: [], requiredMaterials: [], requiredDocuments: ["drawings"], requiredApprovals: ["engineering"], status: "READY", blockers: [] },
  { id: "RS-FAB-1", routingTemplateId: "RT-FAB-ENG", name: "Fabrication", departmentId: "DEPT-FAB", workCenterId: "WC-L1", requiredRole: "Fabricator", estimatedDurationHours: 40, setupHours: 2, dependencyStepIds: ["RS-ENG-1"], requiredMaterials: ["steel", "fasteners"], requiredDocuments: ["shop-drawings"], requiredApprovals: ["release"], status: "QUEUED", blockers: [] },
];

export const mockWorkCenters = [
  { id: "WC-L1", laneId: "L1", name: "Line 1", departmentId: "DEPT-FAB" },
  { id: "WC-L2", laneId: "L2", name: "Line 2", departmentId: "DEPT-ASM" },
  { id: "WC-L3", laneId: "L3", name: "Line 3", departmentId: "DEPT-QC" },
  { id: "WC-L4", laneId: "L4", name: "Line 4", departmentId: "DEPT-SHIP" },
];

export function getReleaseGateIssues(job) {
  const issues = [];
  if (!job.quoteApproved) issues.push("Quote not approved");
  if (!job.estimatingBomApproved) issues.push("Estimating BOM not approved");
  if (!job.salesOrderRef?.netsuiteSalesOrderId) issues.push("NetSuite sales order missing");
  if (!job.routingTemplateId) issues.push("Routing template not assigned");
  if (!job.drawingsReleased) issues.push("Drawings not released");
  if (job.materialReadinessStatus === "NOT_READY") issues.push("Material readiness incomplete");
  if (job.engineeringReleaseStatus !== "RELEASED") issues.push("Engineering release pending");
  if (job.productionReleaseStatus !== "RELEASED") issues.push("Production release pending");
  return issues;
}
