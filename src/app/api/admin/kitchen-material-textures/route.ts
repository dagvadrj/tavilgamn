import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  KITCHEN_TEXTURE_KINDS,
  normalizeAdminKitchenMaterials,
  type KitchenTextureKind,
} from "@/lib/kitchenMaterials";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const headers = { "Cache-Control": "private, no-store" };
const columns = "id,name,surface_kind,base_color,roughness,metalness,texture_paths,active,created_at,updated_at";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

function isTextureKind(value: string): value is KitchenTextureKind {
  return (KITCHEN_TEXTURE_KINDS as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) return fail("Cloudinary тохиргоо дутуу байна.", 503);

    const form = await request.formData().catch(() => null);
    if (!form) return fail("Texture файлаа сонгоно уу.", 400);
    const materialId = String(form.get("materialId") ?? "").trim().toLowerCase();
    const kind = String(form.get("kind") ?? "");
    const file = form.get("file");
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(materialId) || !isTextureKind(kind)) return fail("Материал эсвэл texture-ийн төрөл буруу байна.", 400);
    if (!(file instanceof File) || !file.size || !TYPES.has(file.type)) return fail("JPG, PNG эсвэл WebP texture сонгоно уу.", 400);
    if (file.size > MAX_SIZE) return fail("Texture зураг 8 MB-аас ихгүй байна.", 413);

    const db = getSupabaseAdmin();
    const { data: current, error: readError } = await db.from("material_definitions")
      .select("id,texture_paths").eq("id", materialId).maybeSingle();
    if (readError) throw readError;
    if (!current) return fail("Эхлээд материалаа хадгална уу.", 404);

    const publicId = `casa-nova/kitchen-materials/${materialId}/${kind}`;
    const params: Record<string, string> = {
      allowed_formats: "jpg,png,webp",
      invalidate: "true",
      overwrite: "true",
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const signature = createHash("sha256")
      .update(Object.keys(params).sort().map((name) => `${name}=${params[name]}`).join("&") + secret)
      .digest("hex");
    const upload = new FormData();
    for (const [name, value] of Object.entries(params)) upload.set(name, value);
    upload.set("api_key", key);
    upload.set("signature", signature);
    upload.set("file", file);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: upload,
      signal: AbortSignal.timeout(60_000),
    });
    const image = await response.json().catch(() => null);
    if (!response.ok || typeof image?.secure_url !== "string" || image?.public_id !== publicId) return fail("Texture зураг upload хийж чадсангүй.", 502);
    const url = new URL(image.secure_url);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return fail("Texture зургийн холбоос буруу ирлээ.", 502);

    const texturePaths = current.texture_paths && typeof current.texture_paths === "object" && !Array.isArray(current.texture_paths)
      ? { ...current.texture_paths as Record<string, unknown>, [kind]: url.href }
      : { [kind]: url.href };
    const { data, error } = await db.from("material_definitions").update({ texture_paths: texturePaths })
      .eq("id", materialId).select(columns).single();
    if (error) throw error;
    return NextResponse.json({ material: normalizeAdminKitchenMaterials([data])[0] }, { status: 201, headers });
  } catch (error) {
    console.error("[kitchen material texture]", error);
    return fail("Texture зураг оруулж чадсангүй. Дахин оролдоно уу.", 503);
  }
}
