import { useQuery } from "@tanstack/react-query";
import * as netsuiteService from "../../modules/integrations/netsuiteService";
import * as procoreService from "../../modules/integrations/procoreService";

export function useNetSuiteSync() {
  return useQuery({ queryKey: ["sync", "netsuite", "customers"], queryFn: netsuiteService.syncCustomers });
}

export function useProcoreSync() {
  return useQuery({ queryKey: ["sync", "procore", "projects"], queryFn: procoreService.syncProjects });
}

export function useBomImportProcessing() {
  return useQuery({
    queryKey: ["bom", "import", "placeholder"],
    queryFn: async () => ({ status: "idle", message: "BOM import parser placeholder" }),
  });
}
