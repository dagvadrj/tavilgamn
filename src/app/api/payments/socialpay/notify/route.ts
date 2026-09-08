import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyPayment, verifySocialpayNotification } from "@/lib/payments/providers";

// Register this server notification URL with Golomt for payments whose browser closes.
export async function POST(request: NextRequest) {
  try {
    const notification = verifySocialpayNotification(await request.json());
    if (!notification) return new NextResponse(null, { status: 401 });
    const supabase = getSupabaseAdmin();
    const { data: payment, error } = await supabase.from("order_payments").select("method,invoice_id,state").eq("order_id", notification.orderId).maybeSingle();
    if (error) throw error;
    if (!payment || payment.method !== "socialpay") return new NextResponse(null, { status: 404 });
    const { data: order, error: orderError } = await supabase.from("orders").select("total").eq("id", notification.orderId).single();
    if (orderError) throw orderError;
    if (Number(order.total) !== notification.amount) return new NextResponse(null, { status: 409 });
    if (payment.state !== "paid") {
      const reference = await verifyPayment("socialpay", notification.orderId, payment.invoice_id ?? "", Number(order.total));
      if (!reference) return new NextResponse(null, { status: 409 });
      const { error: confirmError } = await supabase.rpc("confirm_order_payment", { p_order_id: notification.orderId, p_method: "socialpay", p_reference: reference, p_amount: notification.amount });
      if (confirmError) throw confirmError;
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Төлбөрийн мэдэгдэл баталгаажсангүй." }, { status: 503 });
  }
}
