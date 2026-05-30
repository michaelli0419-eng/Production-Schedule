export const ROLES = {
  ADMIN: 'admin',
  ESTIMATOR: 'estimator',
  PM: 'pm',
  SALES: 'sales',
  PRODUCTION: 'production',
  EXECUTIVE: 'executive',
};

export const LINE_IDS = ['L1', 'L2', 'L3', 'L4'];

export const LINE_LABELS = {
  L1: 'Line 1',
  L2: 'Line 2',
  L3: 'Line 3',
  L4: 'Line 4',
};

export const DEPARTMENTS = [
  'Engineering',
  'Procurement',
  'Fabrication',
  'Assembly',
  'QC',
  'Shipping',
];

export const OPP_STAGES = [
  'lead',
  'qualify',
  'estimate',
  'proposal',
  'negotiation',
  'award',
  'handoff',
  'lost',
  'dead',
];

export const OPP_STAGE_LABELS = {
  lead: 'Lead',
  qualify: 'Qualify',
  estimate: 'Estimate',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  award: 'Award',
  handoff: 'Handoff',
  lost: 'Lost',
  dead: 'Dead',
};

export const JOB_STATUSES = [
  'backlog',
  'scheduled',
  'in_production',
  'qc',
  'shipping',
  'complete',
  'on_hold',
  'cancelled',
];

export const JOB_STATUS_LABELS = {
  backlog: 'Backlog',
  scheduled: 'Scheduled',
  in_production: 'In Production',
  qc: 'QC',
  shipping: 'Shipping',
  complete: 'Complete',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

export const JOB_STATUS_COLORS = {
  backlog: '#6b7280',
  scheduled: '#3b82f6',
  in_production: '#f59e0b',
  qc: '#8b5cf6',
  shipping: '#06b6d4',
  complete: '#10b981',
  on_hold: '#ef4444',
  cancelled: '#9ca3af',
};

export const CAPACITY_THRESHOLDS = {
  warning: 0.70,
  critical: 0.90,
};

export const SHORTAGE_LEAD_TIME_DAYS = 14;

export const QUOTE_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'sent',
  'accepted',
  'rejected',
  'expired',
];

export const ACTIVITY_TYPES = [
  'note',
  'call',
  'email',
  'meeting',
  'task',
  'status_change',
  'file_upload',
];

export const SOURCE_TYPES = [
  'referral',
  'website',
  'trade_show',
  'cold_outreach',
  'repeat_customer',
  'broker',
  'other',
];
