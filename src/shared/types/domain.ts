export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";
export type TaskStatus = "QUEUED" | "READY" | "SCHEDULED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface Company { id: string; name: string; netsuiteCustomerId?: string | null; }
export interface Contact { id: string; companyId: string; name: string; email?: string; }
export interface Lead { id: string; companyId: string; contactId?: string; source?: string; status: string; }
export interface Opportunity { id: string; leadId: string; companyId: string; title: string; status: string; value: number; }
export interface Quote { id: string; opportunityId: string; quoteNumber: string; approved: boolean; }
export interface QuoteRevision { id: string; quoteId: string; revisionNumber: number; status: string; }
export interface EstimatingBOM { id: string; quoteRevisionId: string; version: number; originalFilename: string; approved: boolean; }
export interface EstimatingBOMLine { id: string; bomId: string; lineNumber: number; itemNumber: string; description: string; quantity: number; }
export interface SalesOrderReference { netsuiteSalesOrderId: string; syncStatus: SyncStatus; lastSyncedAt?: string; syncErrors?: string[]; }
export interface ProcoreProjectReference { procoreProjectId: string; syncStatus: SyncStatus; documentUrl?: string; lastSyncedAt?: string; syncErrors?: string[]; }

export interface ProductionBlocker { id: string; productionJobId: string; code: string; reason: string; canOverride: boolean; overrideReason?: string; }

export interface ProductionJob {
  id: string;
  jobNumber: string;
  customerName: string;
  opportunityId: string;
  quoteId: string;
  estimatingBomId: string;
  salesOrderRef?: SalesOrderReference;
  procoreRef?: ProcoreProjectReference;
  revenue: number;
  margin: number;
  quantity: number;
  dueDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  routingTemplateId?: string;
  materialReadinessStatus: "NOT_READY" | "READY" | "OVERRIDDEN";
  engineeringReleaseStatus: "PENDING" | "RELEASED";
  productionReleaseStatus: "PENDING" | "RELEASED";
  quoteApproved: boolean;
  estimatingBomApproved: boolean;
  drawingsReleased: boolean;
  blockers: ProductionBlocker[];
  status: "PLANNING" | "READY" | "IN_PRODUCTION" | "BLOCKED" | "COMPLETE";
}

export interface OperationalBOM { id: string; productionJobId: string; sourceEstimatingBomId: string; }
export interface MaterialRequirement { id: string; productionJobId: string; itemNumber: string; quantityRequired: number; quantityAvailable: number; }
export interface RoutingTemplate { id: string; name: string; }
export interface RoutingStep {
  id: string;
  routingTemplateId: string;
  name: string;
  departmentId: string;
  workCenterId: string;
  requiredRole: string;
  estimatedDurationHours: number;
  setupHours: number;
  dependencyStepIds: string[];
  requiredMaterials: string[];
  requiredDocuments: string[];
  requiredApprovals: string[];
  status: TaskStatus;
  blockers: string[];
}

export interface ScheduledTask {
  id: string;
  productionJobId: string;
  routingStepId: string;
  workCenterId: string;
  laneId: string;
  startDateTime: string;
  endDateTime: string;
  durationHours: number;
  status: TaskStatus;
  conflictStatus: "NONE" | "CONFLICT";
  manuallyScheduled: boolean;
  notes?: string;
}

export interface Department { id: string; name: string; }
export interface WorkCenter { id: string; departmentId: string; name: string; laneId: string; }
export interface Machine { id: string; workCenterId: string; name: string; }
export interface Crew { id: string; departmentId: string; name: string; size: number; }
export interface CapacityBucket { id: string; weekStart: string; departmentId: string; workCenterId: string; capacityHours: number; allocatedHours: number; }
export interface IntegrationSyncLog { id: string; provider: "NETSUITE" | "PROCORE"; entityType: string; syncStatus: SyncStatus; syncErrors: string[]; createdAt: string; }
