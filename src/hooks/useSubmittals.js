import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseEnabled, supabase } from "../lib/supabase.js";
import {
  dbRowToSubmittal,
  deleteSubmittal as apiDelete,
  fetchSubmittals,
  upsertSubmittal as apiUpsert,
} from "../lib/submittalsApi.js";

const LS_KEY = "scm-submittals-v1";

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

export function useSubmittals() {
  const [submittals, setSubmittalsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const writingIds = useRef(new Set());

  useEffect(() => {
    if (!isSupabaseEnabled) {
      setSubmittalsState(loadLocal());
      setLoading(false);
      return;
    }
    fetchSubmittals()
      .then((rows) => { setSubmittalsState(rows); setLoading(false); })
      .catch(() => { setSubmittalsState(loadLocal()); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!loading) saveLocal(submittals);
  }, [submittals, loading]);

  // Real-time
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;
    const channel = supabase
      .channel("scm-submittals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "submittals" }, (payload) => {
        const changedId = payload.new?.id ?? payload.old?.id;
        if (writingIds.current.has(changedId)) return;
        if (payload.eventType === "DELETE") {
          setSubmittalsState((c) => c.filter((s) => s.id !== changedId));
          return;
        }
        const sub = dbRowToSubmittal(payload.new);
        setSubmittalsState((c) => {
          const idx = c.findIndex((s) => s.id === sub.id);
          if (idx === -1) return [...c, sub];
          const next = [...c]; next[idx] = sub; return next;
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const saveSubmittal = useCallback(async (sub) => {
    writingIds.current.add(sub.id);
    try {
      const saved = isSupabaseEnabled ? await apiUpsert(sub) : sub;
      setSubmittalsState((c) => {
        const idx = c.findIndex((s) => s.id === saved.id);
        if (idx === -1) return [...c, saved];
        const next = [...c]; next[idx] = saved; return next;
      });
      return saved;
    } finally {
      writingIds.current.delete(sub.id);
    }
  }, []);

  const removeSubmittal = useCallback(async (id) => {
    if (isSupabaseEnabled) await apiDelete(id);
    setSubmittalsState((c) => c.filter((s) => s.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    setLoading(true);
    try { setSubmittalsState(await fetchSubmittals()); }
    catch (err) { console.error("[useSubmittals] refresh failed:", err.message); }
    finally { setLoading(false); }
  }, []);

  return { submittals, loading, saveSubmittal, removeSubmittal, refresh };
}
