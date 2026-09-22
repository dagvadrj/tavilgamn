import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const KINDS = new Set(["thumbnail", "render", "photo", "plan"]);
const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (!UUID.test(params.id)) return NextResponse.json({ error: "Загварын ID буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    const form = await request.formData();
    const file = form.get("file");
    const versionId = form.get("versionId");
    const kind = String(form.get("kind") ?? "thumbnail");
    const isPrimary = String(form.get("isPrimary") ?? "false") === "true";
    if (!(file instanceof File) || !file.size || !TYPES.has(file.type)) throw new Error("INVALID_FILE");
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "Зураг 8 MB-аас ихгүй байна." }, { status: 413, headers: kitchenPrivateHeaders });
    if (typeof versionId !== "string" || !UUID.test(versionId) || !KINDS.has(kind)) {
      return NextResponse.json({ error: "Зургийн мэдээлэл буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    }

    const db = getSupabaseAdmin();
    const [{ data: design }, { data: editable }] = await Promise.all([
      db.from("kitchen_designs").select("store_id").eq("id", params.id).eq("created_by", auth.userId).maybeSingle(),
      db.from("kitchen_design_versions").select("id").eq("id", versionId).eq("design_id", params.id)
        .in("review_status", ["draft", "changes_requested"]).maybeSingle(),
    ]);
    if (!design || !editable) return NextResponse.json({ error: "Энэ хувилбарт зураг нэмэх эрхгүй байна." }, { status: 403, headers: kitchenPrivateHeaders });
    const { data: store } = await db.from("merchant_stores").select("id").eq("id", design.store_id)
      .eq("owner_id", auth.userId).eq("active", true).in("store_type", ["factory", "handmade"]).maybeSingle();
    if (!store) return NextResponse.json({ error: "Энэ дэлгүүр marketplace-д загвар нийтлэх эрхгүй байна." }, { status: 403, headers: kitchenPrivateHeaders });

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) {
      return NextResponse.json({ error: "Зураг хадгалах тохиргоо дутуу байна." }, { status: 503, headers: kitchenPrivateHeaders });
    }
    const uploadParams: Record<string, string> = {
      allowed_formats: "jpg,png,webp",
      overwrite: "false",
      public_id: `casa-nova/kitchens/${params.id}/${randomUUID()}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const signature = createHash("sha256")
      .update(Object.keys(uploadParams).sort().map((name) => `${name}=${uploadParams[name]}`).join("&") + secret)
      .digest("hex");
    const body = new FormData();
    for (const [name, value] of Object.entries(uploadParams)) body.set(name, value);
    body.set("api_key", key);
    body.set("signature", signature);
    body.set("file", file);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST", body, signal: AbortSignal.timeout(60_000),
    });
    const image = await response.json().catch(() => null);
    if (!response.ok || typeof image?.secure_url !== "string") throw new Error("UPLOAD_FAILED");
    const url = new URL(image.secure_url);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") throw new Error("UPLOAD_FAILED");
    const { data: mediaId, error } = await db.rpc("add_kitchen_design_media", {
      p_actor: auth.userId, p_design: params.id, p_version: versionId, p_kind: kind,
      p_url: url.href, p_alt: String(form.get("alt") ?? "").slice(0, 300),
      p_primary: isPrimary, p_width: Number.isInteger(image.width) ? image.width : null,
      p_height: Number.isInteger(image.height) ? image.height : null,
      p_metadata: { cloudinaryPublicId: image.public_id, format: image.format, bytes: image.bytes },
    });
    if (error) throw error;
    return NextResponse.json({ id: mediaId, url: url.href }, { status: 201, headers: kitchenPrivateHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_FILE") {
      return NextResponse.json({ error: "JPG, PNG эсвэл WebP зураг сонгоно уу." }, { status: 400, headers: kitchenPrivateHeaders });
    }
    return kitchenMarketplaceError(error, "Зургийг хадгалж чадсангүй.");
  }
}
