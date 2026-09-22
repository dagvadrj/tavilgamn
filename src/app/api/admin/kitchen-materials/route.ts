import { NextRequest, NextResponse } from "next/server";
import {
  KitchenMaterialInputError,
  normalizeAdminKitchenMaterials,
  parseKitchenMaterialInput,
  parseKitchenMaterialState,
} from "@/lib/kitchenMaterials";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
const columns = "id,name,surface_kind,base_color,roughness,metalness,texture_paths,active,created_at,updated_at";

function fail(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const message = error instanceof KitchenMaterialInputError ? error.message
    : code === "23505" ? "Ийм кодтой материал аль хэдийн байна."
      : code === "42501" ? "Admin эрх шаардлагатай."
        : code === "PGRST116" ? "Материал олдсонгүй." : fallback;
  const status = error instanceof KitchenMaterialInputError ? 400 : code === "23505" ? 409 : code === "42501" ? 403 : code === "PGRST116" ? 404 : 503;
  return NextResponse.json({ error: message }, { status, headers });
}

function toRow(input: ReturnType<typeof parseKitchenMaterialInput>) {
  return {
    name: input.name,
    surface_kind: input.surfaceKind,
    base_color: input.baseColor,
    roughness: input.roughness,
    metalness: input.metalness,
    texture_paths: input.texturePaths,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().from("material_definitions").select(columns).order("name");
    if (error) throw error;
    return NextResponse.json({ materials: normalizeAdminKitchenMaterials(data) }, { headers });
  } catch (error) {
    return fail(error, "Материалуудыг ачаалж чадсангүй.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const input = parseKitchenMaterialInput(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().from("material_definitions")
      .insert({ id: input.id, ...toRow(input), active: true }).select(columns).single();
    if (error) throw error;
    return NextResponse.json({ material: normalizeAdminKitchenMaterials([data])[0] }, { status: 201, headers });
  } catch (error) {
    return fail(error, "Материал нэмж чадсангүй.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const input = parseKitchenMaterialInput(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().from("material_definitions")
      .update(toRow(input)).eq("id", input.id).select(columns).single();
    if (error) throw error;
    return NextResponse.json({ material: normalizeAdminKitchenMaterials([data])[0] }, { headers });
  } catch (error) {
    return fail(error, "Материалын өөрчлөлтийг хадгалж чадсангүй.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const input = parseKitchenMaterialState(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().from("material_definitions")
      .update({ active: input.active }).eq("id", input.id).select(columns).single();
    if (error) throw error;
    return NextResponse.json({ material: normalizeAdminKitchenMaterials([data])[0] }, { headers });
  } catch (error) {
    return fail(error, "Материалын төлөвийг өөрчилж чадсангүй.");
  }
}
