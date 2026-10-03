import { toJson } from "@/lib/supabase/json";
import { apiErrorResponse } from "@/lib/api/errors";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { ModelOptionsError, parseModelColors, parseModelMaterials } from "@/lib/modelOptions";
import { removeStoredModelFiles } from "@/lib/r2Models";
import { CloudinaryModelError, uploadModelAsset } from "@/lib/cloudinaryModels";
import { isCategory } from "@/lib/catalogCategories";
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;
export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin(request);

  if (adminAuth.error) {
    return adminAuth.error;
  }

  const supabase = getSupabaseAdmin();
  const uploadedPaths: string[] = [];

  try {
    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "sofa");
    const description = String(formData.get("description") ?? "").trim();

    const rawStock = formData.get("stockQuantity");
    const stockQuantity = typeof rawStock === "string" && rawStock.trim() !== "" ? Number(rawStock) : NaN;
    if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000) return apiErrorResponse({ error: "Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна." }, { status: 400 });
    const basePrice = Number(formData.get("basePrice") ?? 0);
    const scale = Number(formData.get("scale") ?? 0.001);
    const dimensionsW = Number(formData.get("dimensionsW") ?? 1);
    const dimensionsD = Number(formData.get("dimensionsD") ?? 1);
    const dimensionsH = Number(formData.get("dimensionsH") ?? 1);

   const thumbnailFile =
  formData.get("thumbnail");

    if (!name) {
      return apiErrorResponse(
        { error: "Загварын нэр шаардлагатай" },
        { status: 400 },
      );
    }

    if (!isCategory(category)) {
      return apiErrorResponse(
        { error: "Тавилгын ангилал буруу байна" },
        { status: 400 },
      );
    }

    if (
      thumbnailFile instanceof File &&
      thumbnailFile.size > 0 &&
      (!["image/jpeg", "image/png", "image/webp"].includes(thumbnailFile.type) ||
        thumbnailFile.size > MAX_THUMBNAIL_SIZE)
    ) {
      return apiErrorResponse(
        { error: "Thumbnail нь JPG, PNG, WebP зураг, 10 MB-аас ихгүй байх ёстой" },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(basePrice) ||
      basePrice < 0 ||
      !Number.isFinite(scale) ||
      scale <= 0 ||
      !Number.isFinite(dimensionsW) ||
      dimensionsW <= 0 ||
      !Number.isFinite(dimensionsD) ||
      dimensionsD <= 0 ||
      !Number.isFinite(dimensionsH) ||
      dimensionsH <= 0
    ) {
      return apiErrorResponse(
        { error: "Үнэ, хэмжээ эсвэл scale буруу байна" },
        { status: 400 },
      );
    }

    const colors = parseModelColors(formData.get("colors"));
    const materials = parseModelMaterials(formData.get("materials"));
    const cabinetModuleId = String(formData.get("cabinetModuleId") ?? "");
    if (category === "kitchen-cabinet") {
      if (!/^[0-9a-f-]{36}$/i.test(cabinetModuleId)) return apiErrorResponse({ error: "Kitchen module сонгоно уу." }, { status: 400 });
      const { data: module, error } = await supabase.from("kitchen_modules").select("id,width_mm,height_mm,depth_mm").eq("id", cabinetModuleId).eq("active", true).maybeSingle();
      if (error) throw error;
      if (!module || scale !== 1 || Math.abs(dimensionsW * 1000 - module.width_mm) > 5 || Math.abs(dimensionsH * 1000 - module.height_mm) > 5 || Math.abs(dimensionsD * 1000 - module.depth_mm) > 5) return apiErrorResponse({ error: "Kitchen GLB-д зөв canonical module, метр хэмжээ, scale 1 шаардлагатай." }, { status: 400 });
    }

    const id = randomUUID();


    let thumbnailPath: string | null = null;

    if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
      thumbnailPath = await uploadModelAsset(thumbnailFile, id, "image");
      uploadedPaths.push(thumbnailPath);
    }

    const { data: model, error: databaseError } = await supabase
      .from("furniture_models")
      .insert({
        id,
        product_id: id,
        default_color: colors[0].id,
        name,
        category,
        cabinet_module_id: category === "kitchen-cabinet" ? cabinetModuleId : null,
        description,
        base_price: Math.round(basePrice),
        glb_path: null,
source_glb_path: null,
preview_glb_path: null,

processing_status: "idle",
processing_error: null,

thumbnail_path: thumbnailPath, scale,
        dimensions_w: dimensionsW,
        dimensions_d: dimensionsD,
        dimensions_h: dimensionsH,
        colors: toJson(colors),
        materials: toJson(materials),
        in_stock: stockQuantity,
      })
      .select()
      .single();

    if (databaseError) throw databaseError;

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    if (error instanceof ModelOptionsError) {
      return apiErrorResponse({ error: error.message }, { status: 400 });
    }

    if (uploadedPaths.length > 0) {
      try {
        await removeStoredModelFiles(supabase, uploadedPaths);
        } catch (cleanupError) {
          console.error("[models/upload/cleanup]", cleanupError, uploadedPaths);
          }
    }

    console.error("[models/upload]", error);

    return apiErrorResponse(
      { error: (error instanceof CloudinaryModelError) ? error.message : "Загвар upload хийхэд алдаа гарлаа" },
      { status: (error instanceof CloudinaryModelError) ? 502 : 500 },
    );
  }
}
