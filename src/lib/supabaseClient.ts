import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validasi URL dan Key (mendukung format JWT lama maupun format sb_publishable_ baru)
const hasValidUrl = Boolean(supabaseUrl && supabaseUrl.startsWith("https://"));
const hasValidKey = Boolean(
  supabaseAnonKey &&
    (supabaseAnonKey.startsWith("eyJ") || supabaseAnonKey.startsWith("sb_publishable_")) &&
    supabaseAnonKey.length > 20
);

export const isRealtimeAvailable = Boolean(hasValidUrl && hasValidKey);

if (!isRealtimeAvailable && typeof window !== "undefined") {
  console.warn(
    "Supabase Realtime is disabled: configure complete NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values."
  );
}

export const supabase = isRealtimeAvailable
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;