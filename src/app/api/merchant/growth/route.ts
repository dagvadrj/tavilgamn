import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantHeaders } from "@/lib/merchantServer";
import { parseGrowthAction } from "@/lib/merchantGrowth";
import { growthError, storeShareOrigin } from "@/lib/merchantGrowthServer";
import { toJson, jsonObject } from "@/lib/supabase/json";

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
    return NextResponse.json(
      { ...jsonObject(data), shareOrigin: storeShareOrigin(request.url) },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return growthError(error);
  }
}
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const action = parseGrowthAction(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().rpc(
      "save_merchant_growth",
      {
        p_actor: auth.userId,
        p_action: action.action,
        p_data: toJson(action.data),
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return growthError(error);
  }
}
