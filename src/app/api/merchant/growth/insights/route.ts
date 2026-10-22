import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantHeaders } from "@/lib/merchantServer";
import { CatalogInputError } from "@/lib/catalogValidation";
import { growthError } from "@/lib/merchantGrowthServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
    if (![7, 30, 90].includes(days))
      throw new CatalogInputError("7, 30 эсвэл 90 хоног сонгоно уу.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "merchant_growth_insights",
      { p_actor: auth.userId, p_days: days },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return growthError(error);
  }
}
