import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantHeaders } from "@/lib/merchantServer";
import { parseAdminGrowthAction } from "@/lib/merchantGrowth";
import { growthError } from "@/lib/merchantGrowthServer";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_merchant_growth",
      { p_actor: auth.userId },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return growthError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const action = parseAdminGrowthAction(
      await request.json().catch(() => null),
    );
    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_merchant_growth",
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
