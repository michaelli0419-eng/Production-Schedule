import { create } from "zustand";

export const useCrmStore = create(() => ({ leads: [], companies: [], contacts: [] }));
export const useOpportunityStore = create(() => ({ opportunities: [] }));
export const useQuoteStore = create(() => ({ quotes: [], quoteRevisions: [] }));
export const useBomStore = create(() => ({ estimatingBoms: [], estimatingBomLines: [] }));
export const useProductionJobStore = create(() => ({ productionJobs: [] }));
export const useRoutingStore = create(() => ({ routingTemplates: [], routingSteps: [] }));
export const useIntegrationStore = create(() => ({ syncLogs: [] }));
