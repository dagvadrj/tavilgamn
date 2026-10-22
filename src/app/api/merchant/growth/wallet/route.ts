import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantHeaders } from "@/lib/merchantServer";
import { parseWalletAction } from "@/lib/merchantGrowth";
import { growthError } from "@/lib/merchantGrowthServer";
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const action = parseWalletAction(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().rpc(
      "merchant_wallet_action",
      {
        p_actor: auth.userId,
        p_kind: action.kind,
        p_quantity: action.quantity,
        p_request: action.requestKey,
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return growthError(error);
  }
}
