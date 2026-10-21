import { apiErrorResponse } from "@/lib/api/errors";
import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { storeShareOrigin } from "@/lib/merchantGrowthServer";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id } = await params,
      db = getSupabaseAdmin();
    const store = await db.rpc("merchant_delivery_store", {
      p_actor: auth.userId,
    });
    if (store.error) throw store.error;
    const product = await db
      .from("furniture_models")
      .select("name,store_ids,glb_path,processing_status")
      .eq("product_id", id)
      .is("archived_at", null)
      .maybeSingle();
    if (product.error) throw product.error;
    if (
      !product.data ||
      JSON.stringify(product.data.store_ids) !== JSON.stringify([store.data])
    )
      return apiErrorResponse({ error: "Бараа олдсонгүй." }, { status: 404 });
    if (!product.data.glb_path || product.data.processing_status !== "ready")
      return apiErrorResponse(
        { error: "3D загвар бэлэн болсны дараа QR хэвлэнэ." },
        { status: 409 },
      );
    const url = `${storeShareOrigin(request.url)}/planner?product=${encodeURIComponent(id)}&source=showroom`;
    return NextResponse.json(
      {
        name: product.data.name,
        url,
        qr: await QRCode.toDataURL(url, {
          width: 720,
          margin: 4,
          errorCorrectionLevel: "M",
        }),
      },
      { headers: merchantHeaders },
    );
  } catch (e) {
    return merchantError(e, "QR үүсгэж чадсангүй.");
  }
}
