import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { readKitchenModuleCatalog, readKitchenAssets } from "@/lib/kitchenModuleCatalogServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeKitchenMaterials } from "@/lib/kitchenMaterials";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const [modules, materials, assets] = await Promise.all([
      readKitchenModuleCatalog({}, db),
      db.from("material_definitions").select("id,name,surface_kind,base_color,roughness,metalness,texture_paths").eq("active", true).order("name"),
      readKitchenAssets(db),
    ]);
    if (materials.error) throw materials.error;
    return NextResponse.json({ modules, materials: normalizeKitchenMaterials(materials.data), assets }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiErrorResponse({ error: "Kitchen catalog ачаалж чадсангүй." }, { status: 503 });
  }
}
