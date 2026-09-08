"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "Supabase-ийн public environment variables тохируулагдаагүй байна.",
  );
}

export const supabase = createClient(
  supabaseUrl,
  publishableKey,
);