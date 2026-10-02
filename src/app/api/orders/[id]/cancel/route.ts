import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";
import { OrderInputError } from "@/lib/orderValidation";
import { ORDER_UUID, orderOperationsError, orderOperationsHeaders, parseCancellationRequest } from "@/lib/orderOperations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!ORDER_UUID.test(id)) throw new OrderInputError("Захиалгын дугаар буруу байна.");
    const { reason } = parseCancellationRequest(await request.json().catch(() => { throw new OrderInputError("JSON бүтэц буруу байна."); }));
    const { data, error } = await getSupabaseAdmin().rpc("request_order_cancellation", { p_actor: auth.userId, p_order: id, p_reason: reason });
    if (error) throw error;
    return NextResponse.json(data, { headers: orderOperationsHeaders });
  } catch (error) { return orderOperationsError(error); }
}
