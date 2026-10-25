import "server-only";
import { getSupabaseAdmin } from "./supabase/admin";
import { createCatalogCache } from "./catalogCache";

const materials = createCatalogCache(async () => {
  const { data, count, error } = await getSupabaseAdmin()
    .from("material_definitions")
    .select("id,name,base_color", { count: "exact" })
    .eq("active", true)
    .order("name")
    .limit(4);
  if (error || count === null)
    throw error ?? new Error("Material count unavailable");
  return {
    count,
    swatches: (data ?? [])
      .filter((row) => /^#[0-9a-f]{6}$/i.test(row.base_color))
      .map((row) => ({ id: row.id, name: row.name, color: row.base_color })),
  };
});

export const readHomepageMaterialCount = async () =>
  (await materials.get()).value.count;
export const readHomepageMaterialSwatches = async () =>
  (await materials.get()).value.swatches;
