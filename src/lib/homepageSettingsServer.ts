import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  defaultHomepageSettings,
  type HomepageSettings,
} from "./homepageSettings";
import { parseHomepageHero } from "./homepagePresentation";

export async function readHomepageSettings(): Promise<HomepageSettings> {
  const { data, error } = await getSupabaseAdmin()
    .from("homepage_scene_settings")
    .select("product_ids,version,bed_product_id,wardrobe_product_id,hero")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        productIds: data.product_ids,
        version: data.version,
        bedProductId: data.bed_product_id,
        wardrobeProductId: data.wardrobe_product_id,
        ...(parseHomepageHero(data.hero)
          ? { hero: parseHomepageHero(data.hero)! }
          : {}),
      }
    : defaultHomepageSettings();
}
