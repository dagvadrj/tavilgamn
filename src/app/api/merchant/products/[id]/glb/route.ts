import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantHeaders, merchantError } from "@/lib/merchantServer";
import { CatalogInputError } from "@/lib/catalogValidation";
import { r2ModelKey, r2DownloadUrl } from "@/lib/r2Models";
import { apiErrorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new CatalogInputError("Барааны ID буруу байна.");
    const db = getSupabaseAdmin();
    const store = await db
      .from("merchant_stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .eq("active", true)
      .maybeSingle();
    if (store.error) throw store.error;
    if (!store.data)
      return apiErrorResponse(
        { error: "Идэвхтэй дэлгүүр шаардлагатай." },
        { status: 403, headers: merchantHeaders },
      );
    const model = await db
      .from("furniture_models")
      .select(
        "id,store_ids,glb_path,processing_status,standard_glb_path,export_status",
      )
      .eq("product_id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (model.error) throw model.error;
    const data = model.data;
    if (
      !data ||
      !Array.isArray(data.store_ids) ||
      data.store_ids.length !== 1 ||
      data.store_ids[0] !== store.data.id
    )
      return apiErrorResponse(
        { error: "Бараа олдсонгүй." },
        { status: 404, headers: merchantHeaders },
      );
    const standard =
      data.processing_status === "ready" &&
      data.export_status === "ready" &&
      typeof data.standard_glb_path === "string" &&
      r2ModelKey(data.standard_glb_path);
    const path = standard ? data.standard_glb_path : null;
    if (!path)
      return NextResponse.json(
        { ready: false, status: data.export_status ?? "idle" },
        { headers: merchantHeaders },
      );
    const file = path.split("/").pop();
    if (!file || !/^[a-zA-Z0-9._-]+\.glb$/.test(file))
      throw Error("Invalid model file");
    const url = await r2DownloadUrl(path, `product-${id}-blender.glb`);
    return NextResponse.json(
      { url, standard: true, ready: true, status: "ready" },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return merchantError(error, "GLB татах холбоос үүсгэж чадсангүй.");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new CatalogInputError("Барааны ID буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "request_merchant_model_export",
      {
        p_actor: auth.userId,
        p_product: id,
      },
    );
    if (error) {
      if (error.code === "55000")
        return apiErrorResponse(
          { error: "3D загвар боловсруулагдаж дуусаагүй байна." },
          { status: 409, headers: merchantHeaders },
        );
      throw error;
    }
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(error, "Blender файл бэлтгэж чадсангүй.");
  }
}
