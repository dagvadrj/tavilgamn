import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { ModelOptionsError, parseModelColors, parseModelMaterials } from "@/lib/modelOptions";
import { R2ModelError, uploadR2Glb, removeStoredModelFiles } from "@/lib/r2Models";
import { CloudinaryModelError, uploadModelAsset } from "@/lib/cloudinaryModels";
const BUCKET = "furniture-models";
const MAX_GLB_SIZE = 50 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024;
export const runtime = "nodejs";
export const maxDuration = 180;

const ALLOWED_CATEGORIES = new Set([
  "sofa",
  "wardrobe",
  "dining-table",
  "office",
  "bed",
  "tv-stand",
  "bookshelf",
]);

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
    if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1_000_000) return NextResponse.json({ error: "Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна." }, { status: 400 });
    const basePrice = Number(formData.get("basePrice") ?? 0);
    const scale = Number(formData.get("scale") ?? 0.001);
    const dimensionsW = Number(formData.get("dimensionsW") ?? 1);
    const dimensionsD = Number(formData.get("dimensionsD") ?? 1);
    const dimensionsH = Number(formData.get("dimensionsH") ?? 1);

    const glbFile = formData.get("glb");
    const thumbnailFile = formData.get("thumbnail");

    if (!name) {
      return NextResponse.json(
        { error: "Загварын нэр шаардлагатай" },
        { status: 400 },
      );
    }

    if (!ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "Тавилгын ангилал буруу байна" },
        { status: 400 },
      );
    }

    if (!(glbFile instanceof File) || glbFile.size === 0) {
      return NextResponse.json(
        { error: "GLB файл шаардлагатай" },
        { status: 400 },
      );
    }

    if (!glbFile.name.toLowerCase().endsWith(".glb")) {
      return NextResponse.json(
        { error: "Зөвхөн .glb файл оруулна уу" },
        { status: 400 },
      );
    }

    if (glbFile.size > MAX_GLB_SIZE) {
      return NextResponse.json(
        { error: "GLB файл 50 MB-аас их байж болохгүй" },
        { status: 400 },
      );
    }

    if (
      thumbnailFile instanceof File &&
      thumbnailFile.size > 0 &&
      (!["image/jpeg", "image/png", "image/webp"].includes(thumbnailFile.type) ||
        thumbnailFile.size > MAX_THUMBNAIL_SIZE)
    ) {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Үнэ, хэмжээ эсвэл scale буруу байна" },
        { status: 400 },
      );
    }

    const colors = parseModelColors(formData.get("colors"));
    const materials = parseModelMaterials(formData.get("materials"));

    const id = randomUUID();

    const header = new DataView(await glbFile.slice(0, 12).arrayBuffer());
if (header.byteLength !== 12 || header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== glbFile.size) {  return NextResponse.json({ error: "Хүчинтэй GLB 2.0 файл сонгоно уу." }, { status: 400 }); }
   const glbPath = await uploadR2Glb(glbFile, id);
    uploadedPaths.push(glbPath);

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
        description,
        base_price: Math.round(basePrice),
        glb_path: glbPath,
        thumbnail_path: thumbnailPath,
        scale,
        dimensions_w: dimensionsW,
        dimensions_d: dimensionsD,
        dimensions_h: dimensionsH,
        colors,
        materials,
        in_stock: stockQuantity,
      })
      .select()
      .single();

    if (databaseError) throw databaseError;

    return NextResponse.json(model, { status: 201 });
  } catch (error) {
    if (error instanceof ModelOptionsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (uploadedPaths.length > 0) {
      try {
        await removeStoredModelFiles(supabase, uploadedPaths);
        } catch (cleanupError) {
          console.error("[models/upload/cleanup]", cleanupError, uploadedPaths);
          }
    }

    console.error("[models/upload]", error);

    return NextResponse.json(
      { error: (error instanceof CloudinaryModelError || error instanceof R2ModelError) ? error.message : "Загвар upload хийхэд алдаа гарлаа" },
      { status: (error instanceof CloudinaryModelError || error instanceof R2ModelError) ? 502 : 500 },
    );
  }
}
