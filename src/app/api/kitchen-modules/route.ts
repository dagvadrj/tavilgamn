import { NextResponse } from "next/server";
import { readKitchenModuleCatalog } from "@/lib/kitchenModuleCatalogServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const [modules, materials] = await Promise.all([
      readKitchenModuleCatalog({}, db),
      db.from("material_definitions").select("id,name,surface_kind,base_color,roughness,metalness,texture_paths").eq("active", true).order("name"),
    ]);
    if (materials.error) throw materials.error;
    return NextResponse.json({ modules, materials: materials.data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Kitchen catalog ачаалж чадсангүй." }, { status: 503 });
  }
}
