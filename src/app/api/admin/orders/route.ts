import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000) return NextResponse.json({ error: "Хуудасны дугаар буруу байна." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from("orders")
      .select("id,status,currency,items,subtotal,shipping,total,delivery,created_at,order_payments(method,state)")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 20, page * 20 + 20);
    if (error) throw error;
    return NextResponse.json({ orders: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Захиалгуудыг ачаалж чадсангүй." }, { status: 503 });
  }
}
