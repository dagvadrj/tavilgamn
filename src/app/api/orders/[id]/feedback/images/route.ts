import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { operationUuid } from "@/lib/merchantOperations";
import { uploadCloudinaryImage } from "@/lib/cloudinaryImageUpload";
import { jsonObject } from "@/lib/supabase/json";
import { apiErrorResponse } from "@/lib/api/errors";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorize(request); if (auth.error) return auth.error;
    const orderId = operationUuid((await context.params).id), id = randomUUID();
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024) return apiErrorResponse({ error: "Зураг 5 MB-аас ихгүй байна." }, { status: 413 });
    const form = await request.formData().catch(() => null), file = form?.get("file");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) return apiErrorResponse({ error: "JPG, PNG, WebP зураг (5 MB хүртэл) сонгоно уу." }, { status: 400 });
    const db = getSupabaseAdmin();
    // Register an owned, rate-limited intent before the external upload.
    const intent = await db.rpc("feedback_media", { p_actor: auth.userId, p_order: orderId, p_id: id }); if (intent.error) throw intent.error;
    let bytes;
    try { bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24000000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); }
    catch { return apiErrorResponse({ error: "Зургийг уншиж чадсангүй. Өөр зураг сонгоно уу." }, { status: 400 }); }
    const image = await uploadCloudinaryImage(new Blob([new Uint8Array(bytes)], { type: "image/webp" }), String(jsonObject(intent.data).publicId));
    if (image.publicId !== jsonObject(intent.data).publicId) throw new Error("Image response did not match upload intent");
    const finish = await db.rpc("feedback_media", { p_actor: auth.userId, p_order: orderId, p_id: id, p_url: image.url }); if (finish.error) throw finish.error;
    return NextResponse.json({ url: image.url }, { status: 201, headers: merchantHeaders });
  } catch (e) { return merchantError(e, "Зураг оруулж чадсангүй. Дахин оролдоно уу."); }
}
