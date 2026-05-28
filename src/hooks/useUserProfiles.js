import { useCallback, useEffect, useState } from "react";
import { isSupabaseEnabled, supabase } from "../lib/supabase.js";

export function useUserProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isSupabaseEnabled || !supabase) {
      setProfiles([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, role, can_view_prices, created_at, updated_at")
        .order("email", { ascending: true });
      if (queryError) throw queryError;
      setProfiles(data || []);
    } catch (err) {
      setError(err.message || "Failed to load user profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (profile) => {
    if (!isSupabaseEnabled || !supabase) return { ok: false, error: "Supabase is not configured." };
    const payload = {
      id: String(profile.id || "").trim(),
      email: String(profile.email || "").trim().toLowerCase() || null,
      full_name: String(profile.full_name || "").trim() || null,
      role: String(profile.role || "").trim() || "User",
      can_view_prices: Boolean(profile.can_view_prices),
    };
    if (!payload.id) return { ok: false, error: "User ID is required." };
    const { error: upsertError } = await supabase.from("user_profiles").upsert(payload, { onConflict: "id" });
    if (upsertError) return { ok: false, error: upsertError.message || "Save failed." };
    await refresh();
    return { ok: true };
  }, [refresh]);

  const deleteProfile = useCallback(async (id) => {
    if (!isSupabaseEnabled || !supabase) return { ok: false, error: "Supabase is not configured." };
    const { error: deleteError } = await supabase.from("user_profiles").delete().eq("id", id);
    if (deleteError) return { ok: false, error: deleteError.message || "Delete failed." };
    await refresh();
    return { ok: true };
  }, [refresh]);

  return { profiles, loading, error, refresh, saveProfile, deleteProfile };
}

