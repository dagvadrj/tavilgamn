import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fileNameFromPath = (value: string | null) =>
  value?.split("/").pop() ?? "";

export async function GET(request: NextRequest) {
  const includeArchived = request.nextUrl.searchParams.get("admin") === "1";
  if (includeArchived) { const auth = await requireAdmin(request); if (auth.error) return auth.error; }
  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("furniture_models")
      .select("*")
      .order("created_at", { ascending: false });
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query;

    if (error) throw error;

    const models = (data ?? []).filter(model => includeArchived || model.glb_path).map((model) => ({
      id: model.id,
      archivedAt: model.archived_at,
      name: model.name,
      category: model.category,
      description: model.description,
      basePrice: Number(model.base_price),
      glbFile: fileNameFromPath(model.glb_path),
      previewGlbFile: fileNameFromPath(model.preview_glb_path) || undefined,
      physicalSize: model.category === "kitchen-cabinet" && Boolean(model.glb_validation),
      thumbnailFile: fileNameFromPath(model.thumbnail_path),
      scale: Number(model.scale),
      dimensionsW: Number(model.dimensions_w),
      dimensionsD: Number(model.dimensions_d),
      dimensionsH: Number(model.dimensions_h),
      colors: JSON.stringify(model.colors ?? []),
      materials: JSON.stringify(model.materials ?? []),
      stockQuantity: typeof model.in_stock === "number" ? model.in_stock : null,
      inStock: typeof model.in_stock === "number" && model.in_stock > 0,
      productId: model.product_id,
      createdAt: model.created_at,
    }));

    return NextResponse.json(models, {
      headers: {
        "Cache-Control": "no-store",
        "X-Model-Delivery-Schema": "preview-v1",
      },
    });
  } catch (error) {
    console.error("[models/get]", error);

    return apiErrorResponse(
      { error: "Мэдээлэл авахад алдаа гарлаа" },
      { status: 500 },
    );
  }
}
