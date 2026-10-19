import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonObject } from "@/lib/supabase/json";
import { merchantHeaders } from "@/lib/merchantServer";
import { growthError, storeShareOrigin } from "@/lib/merchantGrowthServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().rpc(
      "read_merchant_growth",
      { p_actor: auth.userId },
    );
    if (error) throw error;
    const snapshot = jsonObject(data),
      profile = jsonObject(snapshot.profile);
    const key = String(profile.slug || snapshot.storeId);
    const png = await QRCode.toBuffer(
      `${storeShareOrigin(request.url)}/store/${encodeURIComponent(key)}`,
      { width: 1200, margin: 4, errorCorrectionLevel: "M", type: "png" },
    );
    return new NextResponse(new Uint8Array(png), {
      headers: {
        ...merchantHeaders,
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="store-qr.png"',
      },
    });
  } catch (error) {
    return growthError(error);
  }
}
