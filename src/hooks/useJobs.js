/**
 * useJobs — unified state management for production scheduler jobs.
 *
 * When Supabase credentials are present (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY):
 *   • Loads jobs from the database on mount
 *   • Writes changes back with a 400ms debounce (drag-safe)
 *   • Subscribes to real-time changes so all team members see updates live
 *   • Deletes are propagated immediately
 *
 * When credentials are NOT set:
 *   • Falls back to localStorage exactly as before
 *   • The rest of the app is unaware of the difference
 *
 * The exported `setJobs` is a drop-in replacement for React's useState setter
 * — it accepts both values and updater functions, matching the existing component.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isSupabaseEnabled, supabase } from "../lib/supabase.js";
import {
  dbRowToJob,
  deleteJob  as apiDelete,
  fetchAllJobs,
  upsertJob  as apiUpsert,
  upsertJobs as apiUpsertMany,
} from "../lib/jobsApi.js";

// ─── localStorage fallback (unchanged from original component) ───────────────

const LS_KEY = "scheduler-jobs-v2";
const LS_KEY_LEGACY = "scheduler-jobs";

function loadFromLocalStorage(sampleJobs) {
  try {
    const saved  = localStorage.getItem(LS_KEY);
    const legacy = localStorage.getItem(LS_KEY_LEGACY);
    return saved  ? JSON.parse(saved)  :
           legacy ? JSON.parse(legacy) :
           sampleJobs;
  } catch {
    return sampleJobs;
  }
}

function saveToLocalStorage(jobs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(jobs));
  } catch {
    // storage full — silently ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param {Array}  sampleJobs  - initial sample data (used when localStorage
 *                               is empty and Supabase is not configured)
 * @param {Function} normalizeJob - normalizer from the component
 */
export function useJobs(sampleJobs, normalizeJob) {
  const [jobs, setJobsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Debounce timers: Map<jobId, timeoutId>
  const writeTimers = useRef(new Map());
  // IDs currently being written to Supabase (suppress realtime echo)
  const writingIds  = useRef(new Set());

  // ── Mount: initial load ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled) {
      // localStorage path
      const raw = loadFromLocalStorage(sampleJobs);
      setJobsState(raw.map(normalizeJob));
      setLoading(false);
      return;
    }

    // Supabase path
    fetchAllJobs()
      .then((fetched) => {
        setJobsState(fetched);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[useJobs] load failed:", err.message);
        // Fall back to localStorage so the app stays usable
        const raw = loadFromLocalStorage(sampleJobs);
        setJobsState(raw.map(normalizeJob));
        setDbError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once

  // ── Persist to localStorage (always, as backup) ──────────────────────────
  useEffect(() => {
    if (!loading) saveToLocalStorage(jobs);
  }, [jobs, loading]);

  // ── Real-time subscription (Supabase only) ───────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) return;

    const channel = supabase
      .channel("scm-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          const changedId = payload.new?.id ?? payload.old?.id;

          // Ignore events triggered by this browser tab's own writes
          if (writingIds.current.has(changedId)) return;

          if (payload.eventType === "DELETE") {
            setJobsState((curr) => curr.filter((j) => j.id !== changedId));
            return;
          }

          const job = dbRowToJob(payload.new);
          setJobsState((curr) => {
            const idx = curr.findIndex((j) => j.id === job.id);
            if (idx === -1) return [...curr, job];          // INSERT
            const next = [...curr];
            next[idx] = job;                               // UPDATE
            return next;
          });
        },
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced Supabase write for a single job ────────────────────────────
  const scheduleWrite = useCallback((job) => {
    if (!isSupabaseEnabled) return;
    const id = job.id;
    clearTimeout(writeTimers.current.get(id));
    writeTimers.current.set(
      id,
      setTimeout(async () => {
        writingIds.current.add(id);
        try {
          await apiUpsert(job);
        } catch (err) {
          console.error("[useJobs] write failed:", err.message);
        } finally {
          writingIds.current.delete(id);
          writeTimers.current.delete(id);
        }
      }, 400), // 400ms — collapses rapid drag events into a single DB write
    );
  }, []);

  // ── setJobs — drop-in replacement for useState setter ───────────────────
  //
  // Accepts a value OR an updater function, exactly like React setState.
  // Detects adds, changes, and deletions and syncs them to Supabase.
  const setJobs = useCallback(
    (updaterOrValue) => {
      setJobsState((prev) => {
        const next =
          typeof updaterOrValue === "function"
            ? updaterOrValue(prev)
            : updaterOrValue;

        if (isSupabaseEnabled) {
          // Changed or new jobs
          for (const job of next) {
            const old = prev.find((j) => j.id === job.id);
            const changed =
              !old ||
              old.start !== job.start ||
              old.end   !== job.end   ||
              old.line  !== job.line  ||
              old.status !== job.status ||
              old.progress !== job.progress ||
              old.name !== job.name ||
              old.color !== job.color ||
              old.notes !== job.notes ||
              old.priority !== job.priority ||
              old.modules !== job.modules ||
              old.crew !== job.crew ||
              JSON.stringify(old.readiness) !== JSON.stringify(job.readiness) ||
              JSON.stringify(old.master)    !== JSON.stringify(job.master);

            if (changed) scheduleWrite(job);
          }

          // Deleted jobs — fire immediately (no debounce)
          for (const job of prev) {
            if (!next.find((j) => j.id === job.id)) {
              writingIds.current.add(job.id);
              apiDelete(job.id)
                .catch((err) => console.error("[useJobs] delete failed:", err.message))
                .finally(() => writingIds.current.delete(job.id));
            }
          }
        }

        return next;
      });
    },
    [scheduleWrite],
  );

  // ── Bulk import (used by Excel sync) ────────────────────────────────────
  // Same as setJobs but optimised — uses a single bulk upsert instead of
  // one-by-one writes, which is much faster for 50+ jobs.
  const setJobsBulk = useCallback((jobs) => {
    setJobsState(jobs);
    if (isSupabaseEnabled) {
      apiUpsertMany(jobs).catch((err) =>
        console.error("[useJobs] bulk upsert failed:", err.message),
      );
    }
  }, []);

  // ── Manual refresh ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    setLoading(true);
    try {
      const fetched = await fetchAllJobs();
      setJobsState(fetched);
    } catch (err) {
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    jobs,
    setJobs,
    setJobsBulk,
    loading,
    dbError,
    refresh,
    isSupabase: isSupabaseEnabled,
  };
}
