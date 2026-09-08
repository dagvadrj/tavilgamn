import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fileNameFromPath = (value: string | null) =>
  value?.split("/").pop() ?? "";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("furniture_models")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const models = (data ?? []).filter(model => model.glb_path).map((model) => ({
      id: model.id,
      name: model.name,
      category: model.category,
      description: model.description,
      basePrice: Number(model.base_price),
      glbFile: fileNameFromPath(model.glb_path),
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
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[models/get]", error);

    return NextResponse.json(
      { error: "Мэдээлэл авахад алдаа гарлаа" },
      { status: 500 },
    );
  }
}
