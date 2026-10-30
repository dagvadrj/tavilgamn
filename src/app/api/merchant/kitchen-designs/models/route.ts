import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { KITCHEN_DESIGN_GLB } from "@/lib/kitchenDesignGlb";
import { storeKitchenDesignGlb } from "@/lib/kitchenDesignModels";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stores a browser-prepared full-kitchen GLB; a design references it by uploadId. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { data: store, error } = await getSupabaseAdmin().from("merchant_stores").select("id")
      .eq("owner_id", auth.userId).eq("active", true).in("store_type", ["factory", "handmade"]).maybeSingle();
    if (error) throw error;
    if (!store) return apiErrorResponse({ error: "Энэ дэлгүүр marketplace-д загвар нийтлэх эрхгүй байна." }, { status: 403, headers: kitchenPrivateHeaders });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || !/\.glb$/i.test(file.name))
      return apiErrorResponse({ error: "GLB файл сонгоно уу." }, { status: 400, headers: kitchenPrivateHeaders });
    if (file.size > KITCHEN_DESIGN_GLB.maxOutputBytes)
      return apiErrorResponse({ error: "GLB файл 40 MB-аас ихгүй байна." }, { status: 413, headers: kitchenPrivateHeaders });
    const { record, info } = await storeKitchenDesignGlb(auth.userId, file);
    return NextResponse.json({
      uploadId: record.uploadId,
      widthMm: info.widthMm,
      depthMm: info.depthMm,
      heightMm: info.heightMm,
      bytes: info.bytes,
      meshes: info.meshes,
      triangles: info.triangles,
    }, { status: 201, headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "GLB файлыг хадгалж чадсангүй.");
  }
}
