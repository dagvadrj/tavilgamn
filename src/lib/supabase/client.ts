"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);

export const supabase = createClient<Database>(
  supabaseUrl ?? "http://127.0.0.1:54321",
  publishableKey ?? "public-anon-key",
);

export async function isSocialProviderEnabled(provider: "google" | "apple") {
  if (!supabaseUrl || !publishableKey) return false;
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Failed to fetch authentication settings");
  const settings = await response.json();
  return settings.external?.[provider] === true;
}
