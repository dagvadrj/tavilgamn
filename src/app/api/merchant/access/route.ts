import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request); if (auth.error) return auth.error;
    if (auth.verifiedEmail) {
      const claim = await getSupabaseAdmin().rpc("claim_merchant_membership", { p_actor: auth.userId, p_verified_email: auth.verifiedEmail });
      if (claim.error) throw claim.error;
    }
    const { data, error } = await getSupabaseAdmin().rpc("merchant_workspace_access", { p_actor: auth.userId });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (e) { return merchantError(e, "Дэлгүүрийн эрхийг шалгаж чадсангүй."); }
}
