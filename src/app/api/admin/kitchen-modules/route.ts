import { NextRequest, NextResponse } from "next/server";
import { KitchenModuleInputError, parseKitchenModelDelete, parseKitchenVariantInput, parseVariantState } from "@/lib/kitchenModuleCatalog";
import { readKitchenModelCandidates, readKitchenModuleCatalog } from "@/lib/kitchenModuleCatalogServer";
import { removeStoredModelFiles } from "@/lib/r2Models";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: unknown, fallback: string) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const databaseMessage = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const invalidVariant = databaseMessage === "Variant does not fit module"
    ? "Хаалга, шургуулгын хийц тухайн module-д тохирохгүй байна. Хийцийн preset-ээ шалгана уу."
    : databaseMessage === "Model dimensions do not match module"
      ? "GLB-ийн хэмжээ сонгосон module-тэй таарахгүй байна."
      : databaseMessage === "Ready kitchen GLB required"
        ? "Бэлэн болсон kitchen GLB сонгоно уу."
        : "GLB-ийн хэмжээ module-тэй таарахгүй эсвэл variant тохирохгүй байна.";
  const message = error instanceof KitchenModuleInputError ? error.message
    : code === "42501" ? "Admin эрх шаардлагатай."
      : code === "P0002" ? "Module эсвэл model олдсонгүй."
        : code === "22023" ? invalidVariant : fallback;
  return NextResponse.json({ error: message }, { status: error instanceof KitchenModuleInputError || code === "22023" ? 400 : code === "42501" ? 403 : code === "P0002" ? 404 : 503, headers });
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request); if (auth.error) return auth.error;
    const db = getSupabaseAdmin();
    const [modules, models] = await Promise.all([readKitchenModuleCatalog({ admin: true }, db), readKitchenModelCandidates(db)]);
    return NextResponse.json({ modules, models }, { headers });
  } catch (error) { return fail(error, "Kitchen module catalog ачаалж чадсангүй."); }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request); if (auth.error) return auth.error;
    const input = parseKitchenVariantInput(await request.json().catch(() => null));
    const { error } = await getSupabaseAdmin().rpc("save_kitchen_module_variant", {
      p_actor: auth.userId, p_model: input.modelId, p_module: input.moduleId, p_payload: input.payload,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201, headers });
  } catch (error) { return fail(error, "Variant хадгалж чадсангүй."); }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request); if (auth.error) return auth.error;
    const input = parseVariantState(await request.json().catch(() => null));
    const { error } = await getSupabaseAdmin().rpc("set_kitchen_module_variant_active", {
      p_actor: auth.userId, p_model: input.modelId, p_active: input.active,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) { return fail(error, "Variant төлөвийг өөрчилж чадсангүй."); }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request); if (auth.error) return auth.error;
    const { modelId } = parseKitchenModelDelete(await request.json().catch(() => null));
    const db = getSupabaseAdmin();
    const { data: model, error: modelError } = await db.from("furniture_models")
      .select("id,category,glb_path,source_glb_path,high_glb_path,medium_glb_path,low_glb_path,standard_glb_path,thumbnail_path")
      .eq("id", modelId).maybeSingle();
    if (modelError) throw modelError;
    if (!model) return NextResponse.json({ error: "Kitchen GLB олдсонгүй." }, { status: 404, headers });
    if (model.category !== "kitchen-cabinet") throw new KitchenModuleInputError("Зөвхөн kitchen GLB устгаж болно.");

    const { data: variants, error: variantReadError } = await db.from("kitchen_module_variants")
      .select("*").eq("furniture_model_id", modelId);
    if (variantReadError) throw variantReadError;
    const { error: unlinkError } = await db.from("kitchen_module_variants").delete().eq("furniture_model_id", modelId);
    if (unlinkError) throw unlinkError;
    const { data: deleted, error: deleteError } = await db.from("furniture_models")
      .delete().eq("id", modelId).eq("category", "kitchen-cabinet").select("id").maybeSingle();
    if (deleteError || !deleted) {
      if (variants?.length) await db.from("kitchen_module_variants").insert(variants);
      if (deleteError) throw deleteError;
      return NextResponse.json({ error: "Kitchen GLB олдсонгүй." }, { status: 404, headers });
    }

    const storedPaths = [model.glb_path, model.source_glb_path, model.high_glb_path, model.medium_glb_path,
      model.low_glb_path, model.standard_glb_path, model.thumbnail_path]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    let warning: string | null = null;
    try { await removeStoredModelFiles(db, storedPaths); }
    catch (cleanupError) { console.error("[kitchen model cleanup]", modelId, cleanupError); warning = "Model устсан боловч storage цэвэрлэгээг дахин шалгана уу."; }
    return NextResponse.json({ ok: true, warning }, { headers });
  } catch (error) { return fail(error, "Kitchen GLB устгаж чадсангүй."); }
}
