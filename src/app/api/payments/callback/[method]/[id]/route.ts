import { apiErrorResponse } from "@/lib/api/errors";
import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/payments/providers";

async function callback(request: NextRequest, { params }: { params: Promise<{ method: string; id: string }> }) {
  const routeParams = await params;
  if (routeParams.method !== "qpay" && routeParams.method !== "socialpay") return new NextResponse(null, { status: 404 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new NextResponse(null, { status: 401 });
  try {
    const supabase = getSupabaseAdmin();
    const { data: payment, error } = await supabase.from("order_payments").select("callback_token,invoice_id,state,method").eq("order_id", routeParams.id).maybeSingle();
    if (error) throw error;
    if (!payment || payment.method !== routeParams.method || !/^[0-9a-f]{64}$/.test(payment.callback_token) || !timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(payment.callback_token, "hex"))) return new NextResponse(null, { status: 401 });
    if (payment.state !== "paid") {
      if (!payment.invoice_id) return new NextResponse(null, { status: 503 });
      const { data: order, error: orderError } = await supabase.from("orders").select("total").eq("id", routeParams.id).single();
      if (orderError) throw orderError;
      const reference = await verifyPayment(routeParams.method, routeParams.id, payment.invoice_id, Number(order.total));
      if (reference) {
        const { error: confirmError } = await supabase.rpc("confirm_order_payment", { p_order_id: routeParams.id, p_method: routeParams.method, p_reference: reference, p_amount: Number(order.total) });
        if (confirmError) throw confirmError;
      }
    }
    if (routeParams.method === "socialpay") {
      // The browser return is only navigation; provider inquiry above is the proof.
      return NextResponse.redirect(new URL(`/orders/${routeParams.id}`, process.env.APP_URL), 303);
    }
    return NextResponse.json({ success: true });
  } catch {
    return apiErrorResponse({ error: "Төлбөр баталгаажуулахад алдаа гарлаа." }, { status: 503 });
  }
}
export const GET = callback;
export const POST = callback;
