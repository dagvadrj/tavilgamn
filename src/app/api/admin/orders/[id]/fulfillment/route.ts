import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { isRecord, OrderInputError } from "@/lib/orderValidation";
import { ORDER_UUID, orderOperationsError, orderOperationsHeaders } from "@/lib/orderOperations";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    const body: unknown = await request.json().catch(() => { throw new OrderInputError("JSON бүтэц буруу байна."); });
    if (!ORDER_UUID.test(id) || !isRecord(body) || !["processing", "shipped", "delivered"].includes(String(body.status))
      || !["pending", "processing", "shipped"].includes(String(body.expectedStatus))) {
      throw new OrderInputError("Хүргэлтийн төлөв буруу байна.");
    }
    const { error } = await getSupabaseAdmin().rpc("update_platform_order", {
      p_actor: auth.userId, p_order: id, p_status: String(body.status), p_expected_status: String(body.expectedStatus),
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: orderOperationsHeaders });
  } catch (error) { return orderOperationsError(error); }
}
