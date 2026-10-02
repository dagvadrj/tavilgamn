import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { OrderInputError } from "@/lib/orderValidation";
import { ORDER_UUID, orderOperationsError, orderOperationsHeaders, parseCancellationResolution } from "@/lib/orderOperations";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!ORDER_UUID.test(id)) throw new OrderInputError("Захиалгын дугаар буруу байна.");
    const body = parseCancellationResolution(await request.json().catch(() => { throw new OrderInputError("JSON бүтэц буруу байна."); }));
    const { data, error } = await getSupabaseAdmin().rpc("resolve_order_cancellation", {
      p_actor: auth.userId, p_order: id, p_action: body.action, p_note: body.note,
      p_reference: body.reference, p_amount: body.amount,
    });
    if (error) throw error;
    return NextResponse.json(data, { headers: orderOperationsHeaders });
  } catch (error) { return orderOperationsError(error); }
}
