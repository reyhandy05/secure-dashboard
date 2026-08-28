import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasValidUrl = Boolean(supabaseUrl?.startsWith("https://"));
const hasValidKey = Boolean(
  supabaseAnonKey &&
    (supabaseAnonKey.startsWith("eyJ") || supabaseAnonKey.startsWith("sb_publishable_")) &&
    !supabaseAnonKey.includes("...")
);

export const isRealtimeAvailable = hasValidUrl && hasValidKey;

if (!isRealtimeAvailable && typeof window !== "undefined") {
  console.warn(
    "Supabase Realtime is disabled: configure complete NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY values."
  );
}

export const supabase = isRealtimeAvailable
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
