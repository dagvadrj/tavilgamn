import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isPaymentMethod } from "@/lib/payments";
import { createPayment, PaymentConfigError, validatePaymentConfig } from "@/lib/payments/providers";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const { method } = await request.json();
    if (!isPaymentMethod(method)) return NextResponse.json({ error: "Төлбөрийн аргаа сонгоно уу." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("id,total,status").eq("id", params.id).eq("user_id", auth.userId).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Захиалга олдсонгүй." }, { status: 404 });
    if (order.status !== "pending_payment") return NextResponse.json({ error: "Энэ захиалга төлбөр хүлээж буй төлөвт биш байна." }, { status: 409 });
    const { data: existing, error: findError } = await supabase.from("order_payments").select("method,state,instructions,created_at").eq("order_id", order.id).maybeSingle();
    if (findError) throw findError;
    if (existing) return paymentResponse(existing, method);
    validatePaymentConfig(method);
    const callbackToken = randomBytes(32).toString("hex");
    const { error: claimError } = await supabase.from("order_payments").insert({ order_id: order.id, method, callback_token: callbackToken });
    if (claimError?.code === "23505") {
      const { data, error: replayError } = await supabase.from("order_payments").select("method,state,instructions,created_at").eq("order_id", order.id).single();
      if (replayError) throw replayError;
      return paymentResponse(data, method);
    }
    if (claimError) throw claimError;
    try {
      const result = await createPayment(method, order.id, Number(order.total), callbackToken);
      const { error: saveError } = await supabase.from("order_payments").update({ state: "ready", invoice_id: result.invoiceId, instructions: result.instructions }).eq("order_id", order.id).eq("state", "creating");
      if (saveError) throw saveError;
      return NextResponse.json({ method, state: "ready", instructions: result.instructions }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // Never create another remote invoice when a timeout may have hidden success.
      await supabase.from("order_payments").update({ state: "needs_review" }).eq("order_id", order.id).eq("state", "creating");
      return NextResponse.json({ error: "Нэхэмжлэхийн хариу тодорхойгүй байна. Давхар төлбөр хийхгүйгээр дэлгүүртэй холбогдоно уу." }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof PaymentConfigError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof SyntaxError || error instanceof TypeError) return NextResponse.json({ error: "Төлбөрийн хүсэлт буруу байна." }, { status: 400 });
    return NextResponse.json({ error: "Төлбөрийн мэдээлэл авч чадсангүй." }, { status: 503 });
  }
}
function paymentResponse(data: { method: string; state: string; instructions: unknown; created_at: string }, method: string) {
  if (data.method !== method) return NextResponse.json({ error: "Энэ захиалгын төлбөрийн арга сонгогдсон байна. Өмнөх нэхэмжлэхээр төлнө үү." }, { status: 409 });
  if (data.state === "needs_review" || (data.state === "creating" && Date.now() - Date.parse(data.created_at) > 60000)) return NextResponse.json({ error: "Нэхэмжлэхийг дэлгүүрээр шалгуулна уу. Давхар төлбөр бүү хийнэ үү." }, { status: 409 });
  if (data.state === "creating") return NextResponse.json({ error: "Нэхэмжлэх үүсгэж байна. Түр хүлээгээд дахин нээнэ үү." }, { status: 409 });
  return NextResponse.json({ method: data.method, state: data.state, instructions: data.instructions }, { headers: { "Cache-Control": "no-store" } });
}
