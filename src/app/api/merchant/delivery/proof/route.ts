import { apiErrorResponse } from "@/lib/api/errors";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { operationUuid } from "@/lib/merchantOperations";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const orderId = operationUuid(
        new URL(request.url).searchParams.get("orderId"),
      ),
      db = getSupabaseAdmin();
    const store = await db.rpc("merchant_delivery_store", {
      p_actor: auth.userId,
    });
    if (store.error) throw store.error;
    const owned = await db
      .from("merchant_order_fulfillments")
      .select("order_id")
      .eq("order_id", orderId)
      .eq("store_id", store.data)
      .eq("owner_id", auth.userId)
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data)
      return apiErrorResponse(
        { error: "Баримт олдсонгүй." },
        { status: 404, headers: merchantHeaders },
      );
    const evidence = await db
      .from("merchant_delivery_evidence")
      .select("storage_path")
      .eq("order_id", orderId)
      .eq("store_id", store.data)
      .maybeSingle();
    if (evidence.error) throw evidence.error;
    if (!evidence.data?.storage_path)
      return apiErrorResponse(
        { error: "Зураг хавсаргаагүй байна." },
        { status: 404, headers: merchantHeaders },
      );
    const signed = await db.storage
      .from("merchant-private")
      .createSignedUrl(evidence.data.storage_path, 300);
    if (signed.error) throw signed.error;
    return NextResponse.json(
      { url: signed.data.signedUrl },
      { headers: merchantHeaders },
    );
  } catch (e) {
    return merchantError(e, "Баримтын зургийг нээж чадсангүй.");
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024)
      throw new CatalogInputError("Зураг 5 MB хүртэл байна.");
    const form = await request.formData(),
      orderId = operationUuid(form.get("orderId")),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw new CatalogInputError(
        "JPG, PNG, WebP зураг (5 MB хүртэл) сонгоно уу.",
      );
    const db = getSupabaseAdmin(),
      access = await db.rpc("delivery_evidence_access", {
        p_actor: auth.userId,
        p_order: orderId,
      });
    if (access.error) throw access.error;
    let bytes;
    try {
      bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 24000000,
      })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new CatalogInputError("Зургийг уншиж чадсангүй.");
    }
    const path = `${auth.userId}/${access.data}/delivery/${orderId}/${randomUUID()}.jpg`;
    const uploaded = await db.storage
      .from("merchant-private")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const registered = await db.rpc("register_delivery_evidence", {
      p_actor: auth.userId,
      p_order: orderId,
      p_path: path,
    });
    if (registered.error) {
      if (["42501", "22023"].includes(registered.error.code))
        await db.storage.from("merchant-private").remove([path]);
      throw registered.error;
    }
    return NextResponse.json({ ok: true }, { headers: merchantHeaders });
  } catch (e) {
    return merchantError(e, "Хүлээлгэн өгсөн зургийг хадгалж чадсангүй.");
  }
}
