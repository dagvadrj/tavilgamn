import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/orderValidation";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.reference !== "string" || body.reference.trim().length < 3 || body.reference.length > 100 || !Number.isSafeInteger(body.amount)) {
      return NextResponse.json({ error: "Дансны хуулга дахь гүйлгээний дугаар, дүнг оруулна уу." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase.from("orders").select("total").eq("id", params.id).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Захиалга олдсонгүй." }, { status: 404 });
    if (Number(order.total) !== body.amount) return NextResponse.json({ error: "Шилжүүлгийн дүн захиалгын дүнтэй таарахгүй байна." }, { status: 409 });
    const { error: confirmError } = await supabase.rpc("confirm_order_payment", {
      p_order_id: params.id, p_method: "bank_transfer", p_reference: body.reference.trim(), p_amount: body.amount, p_verified_by: auth.userId,
    });
    if (confirmError) return NextResponse.json({ error: "Гүйлгээ давхардсан эсвэл захиалгын төлөв тохирохгүй байна. Шалгана уу." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Шилжүүлгийг баталгаажуулж чадсангүй." }, { status: 503 });
  }
}
