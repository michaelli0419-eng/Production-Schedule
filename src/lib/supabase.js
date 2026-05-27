/**
 * Supabase client — lazy-initialised so the app still runs on localStorage
 * until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are added to .env.local
 */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL  ?? "";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** True once you've added your Supabase credentials to .env.local */
export const isSupabaseEnabled = Boolean(url && key);

/** Supabase client — null when credentials are missing */
export const supabase = isSupabaseEnabled ? createClient(url, key) : null;
