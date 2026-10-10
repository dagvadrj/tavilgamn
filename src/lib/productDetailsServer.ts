import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "./supabase/requireAdmin";
import { requireMerchant } from "./supabase/requireMerchant";
import { getSupabaseAdmin } from "./supabase/admin";
import { productFromRow } from "./catalogServer";
import { apiErrorResponse } from "./api/errors";
import { productModelVersions, type HistoryAsset } from "./productModelHistory";
import { r2ModelKey, r2DownloadUrl } from "./r2Models";
import { cloudinaryModelAsset } from "./cloudinaryModels";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
export async function productDetailsResponse(
  request: NextRequest,
  params: Promise<{ id: string }>,
  scope: "admin" | "merchant",
) {
  const auth = await (scope === "admin"
    ? requireAdmin(request)
    : requireMerchant(request));
  if (auth.error) return auth.error;
  const fail = (error: string, status: number) =>
    apiErrorResponse({ error }, { status, headers });
  try {
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      return fail("Барааны ID буруу байна.", 400);
    const db = getSupabaseAdmin();
    const { data: model, error } = await db
      .from("furniture_models")
      .select("*")
      .eq("product_id", id)
      .maybeSingle();
    if (error) throw error;
    if (!model) return fail("Бүтээгдэхүүн олдсонгүй.", 404);
    if (scope === "merchant") {
      const stores = Array.isArray(model.store_ids)
        ? model.store_ids.filter(
            (store): store is string => typeof store === "string",
          )
        : [];
      // Match read_merchant_products_v2: merchant products belong to exactly one store.
      if (stores.length !== 1) return fail("Бүтээгдэхүүн олдсонгүй.", 404);
      const { data: owned, error: ownerError } = await db
        .from("merchant_stores")
        .select("id")
        .in("id", stores)
        .eq("owner_id", auth.userId)
        .eq("active", true)
        .limit(1);
      if (ownerError) throw ownerError;
      if (!owned?.length) return fail("Бүтээгдэхүүн олдсонгүй.", 404);
    }
    const assetId = request.nextUrl.searchParams.get("assetId");
    if (assetId) {
      if (!/^[0-9a-f-]{36}$/i.test(assetId))
        return fail("GLB ID буруу байна.", 400);
      const { data: asset, error: assetError } = await db
        .from("model_assets")
        .select("*")
        .eq("model_id", model.id)
        .eq("id", assetId)
        .maybeSingle();
      if (assetError) throw assetError;
      if (
        !asset ||
        !["source", "preview", "delivery"].includes(asset.role) ||
        !(
          ["available", "retired"].includes(asset.state) ||
          (asset.role === "source" && asset.state === "pending")
        )
      )
        return fail("GLB файл олдсонгүй.", 404);
      const path = asset.storage_path;
      let url: string;
      if (r2ModelKey(path)) url = await r2DownloadUrl(path);
      else if (cloudinaryModelAsset(path)) url = path;
      else if (
        path.startsWith(`${model.id}/`) &&
        /^[a-zA-Z0-9._-]+\.glb$/i.test(path.slice(model.id.length + 1))
      )
        url = db.storage.from("furniture-models").getPublicUrl(path)
          .data.publicUrl;
      else return fail("GLB файлын зам буруу байна.", 404);
      const upstream = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(120000),
      });
      if (upstream.status === 404)
        return fail(
          "Энэ upload-ийн файл хадгалагдаагүй эсвэл цэвэрлэгдсэн байна.",
          404,
        );
      if (!upstream.ok || !upstream.body) throw new Error("GLB fetch failed");
      return new NextResponse(upstream.body, {
        headers: {
          ...headers,
          "Content-Type": "model/gltf-binary",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const assets: HistoryAsset[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error: historyError } = await db
        .from("model_assets")
        .select("id,version_id,role,state,byte_size,original_name,created_at")
        .eq("model_id", model.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (historyError) throw historyError;
      assets.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    // Derive the active version from the published asset, even during a replacement upload.
    const { data: current, error: currentError } = model.glb_path
      ? await db
          .from("model_assets")
          .select("version_id")
          .eq("model_id", model.id)
          .eq("storage_path", model.glb_path)
          .maybeSingle()
      : { data: null, error: null };
    if (currentError) throw currentError;
    return NextResponse.json(
      {
        product: productFromRow(model),
        createdAt: model.created_at,
        updatedAt: model.updated_at,
        processingStatus: model.processing_status,
        processingError: model.processing_error,
        archivedAt: model.archived_at,
        versions: productModelVersions(assets, current?.version_id ?? null),
      },
      { headers },
    );
  } catch (error) {
    console.error("[product details]", error);
    return fail("Бүтээгдэхүүний дэлгэрэнгүйг ачаалж чадсангүй.", 503);
  }
}
