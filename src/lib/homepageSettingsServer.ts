import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  defaultHomepageSettings,
  type HomepageSettings,
} from "./homepageSettings";

export async function readHomepageSettings(): Promise<HomepageSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("homepage_scene_settings")
    .select("product_ids,version")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { productIds: data.product_ids, version: data.version }
    : defaultHomepageSettings();
}
