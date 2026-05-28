import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseEnabled, supabase } from "../lib/supabase.js";
import {
  dbRowToPipelineDeal,
  deletePipelineDeal as apiDelete,
  fetchAllPipelineDeals,
  upsertPipelineDeal as apiUpsert,
  upsertPipelineDeals as apiUpsertMany,
} from "../lib/pipelineApi.js";

const LS_KEY = "scheduler-pipeline-v1";

export function usePipelineDeals(sampleDeals) {
  const [deals, setDealsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const writeTimers = useRef(new Map());
  const writingIds = useRef(new Set());

  useEffect(() => {
    if (!isSupabaseEnabled) {
      const saved = localStorage.getItem(LS_KEY);
      setDealsState(saved ? JSON.parse(saved) : sampleDeals);
      setLoading(false);
      return;
    }

    fetchAllPipelineDeals()
      .then((rows) => {
        setDealsState(rows.length ? rows : sampleDeals);
        setLoading(false);
      })
      .catch((err) => {
        const saved = localStorage.getItem(LS_KEY);
        setDealsState(saved ? JSON.parse(saved) : sampleDeals);
        setDbError(err.message);
        setLoading(false);
      });
  }, [sampleDeals]);

  useEffect(() => {
    if (!loading) localStorage.setItem(LS_KEY, JSON.stringify(deals));
  }, [deals, loading]);

  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    const channel = supabase
      .channel("scm-pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_pipeline_deals" }, (payload) => {
        const changedId = payload.new?.id ?? payload.old?.id;
        if (writingIds.current.has(changedId)) return;

        if (payload.eventType === "DELETE") {
          setDealsState((curr) => curr.filter((d) => d.id !== changedId));
          return;
        }

        const deal = dbRowToPipelineDeal(payload.new);
        setDealsState((curr) => {
          const idx = curr.findIndex((d) => d.id === deal.id);
          if (idx === -1) return [...curr, deal];
          const next = [...curr];
          next[idx] = deal;
          return next;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const scheduleWrite = useCallback((deal) => {
    if (!isSupabaseEnabled) return;
    clearTimeout(writeTimers.current.get(deal.id));
    writeTimers.current.set(deal.id, setTimeout(async () => {
      writingIds.current.add(deal.id);
      try {
        await apiUpsert(deal);
      } finally {
        writingIds.current.delete(deal.id);
        writeTimers.current.delete(deal.id);
      }
    }, 300));
  }, []);

  const setDeals = useCallback((updaterOrValue) => {
    setDealsState((prev) => {
      const next = typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue;

      if (isSupabaseEnabled) {
        for (const deal of next) {
          const old = prev.find((d) => d.id === deal.id);
          if (!old || JSON.stringify(old) !== JSON.stringify(deal)) scheduleWrite(deal);
        }
        for (const deal of prev) {
          if (!next.find((d) => d.id === deal.id)) {
            writingIds.current.add(deal.id);
            apiDelete(deal.id).finally(() => writingIds.current.delete(deal.id));
          }
        }
      }
      return next;
    });
  }, [scheduleWrite]);

  const setDealsBulk = useCallback((nextDeals) => {
    setDealsState(nextDeals);
    if (isSupabaseEnabled) apiUpsertMany(nextDeals).catch(() => {});
  }, []);

  return { deals, setDeals, setDealsBulk, loading, dbError };
}
