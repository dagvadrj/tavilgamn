import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders")
      .select("id,status,currency,items,subtotal,shipping,total,delivery,created_at")
      .eq("id", params.id).eq("user_id", auth.userId).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Захиалга олдсонгүй." }, { status: 404 });
    const { data: payment, error: paymentError } = await supabase.from("order_payments")
      .select("method,state,instructions").eq("order_id", params.id).maybeSingle();
    if (paymentError) throw paymentError;
    return NextResponse.json({ order, payment }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Захиалга ачаалж чадсангүй." }, { status: 503 });
  }
}
