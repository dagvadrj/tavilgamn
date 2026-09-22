import { NextRequest, NextResponse } from "next/server";
import { KitchenModuleInputError, parseKitchenVariantInput, parseVariantState } from "@/lib/kitchenModuleCatalog";
import { readKitchenModelCandidates, readKitchenModuleCatalog } from "@/lib/kitchenModuleCatalogServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (error: unknown, fallback: string) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof KitchenModuleInputError ? error.message
    : code === "42501" ? "Admin эрх шаардлагатай."
      : code === "P0002" ? "Module эсвэл model олдсонгүй."
        : code === "22023" ? "GLB-ийн хэмжээ module-тэй таарахгүй эсвэл variant тохирохгүй байна." : fallback;
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
