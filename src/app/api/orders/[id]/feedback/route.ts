import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { operationUuid, parseFeedback } from "@/lib/merchantOperations";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
async function run(request: NextRequest, context: Context, write: boolean) {
  try {
    const auth = await authorize(request); if (auth.error) return auth.error;
    const id = operationUuid((await context.params).id);
    const raw = write ? await request.json().catch(() => null) : null;
    const { data, error } = await getSupabaseAdmin().rpc("customer_store_feedback", { p_actor: auth.userId, p_action: write ? raw?.action : "read", p_data: write ? parseFeedback(raw?.action, { ...raw?.data, orderId: id }) : { orderId: id } });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (e) { return merchantError(e, "Хүсэлтийг хадгалж чадсангүй."); }
}
export const GET = (r: NextRequest, c: Context) => run(r, c, false);
export const POST = (r: NextRequest, c: Context) => run(r, c, true);
