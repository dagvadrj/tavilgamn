import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { OrderInputError, parseOrderBody } from "@/lib/orderValidation";
import { quoteOrder } from "@/lib/orderService";

export const dynamic = "force-dynamic";
const FIELDS = "id,status,currency,items,subtotal,shipping,total,delivery,created_at";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const url = new URL(request.url);
    const page = Math.max(0, Math.min(100000, Number(url.searchParams.get("page")) || 0));
    if (!Number.isInteger(page)) throw new OrderInputError("Хуудасны дугаар буруу байна.");
    const { data, error } = await getSupabaseAdmin().from("orders").select(FIELDS)
      .eq("user_id", auth.userId).order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(page * 20, page * 20 + 20);
    if (error) throw error;
    return NextResponse.json({ orders: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 }, { headers });
  } catch (error) {
    return orderError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const body = parseOrderBody(await request.json());
    const supabase = getSupabaseAdmin();
    const requestHash = createHash("sha256").update(JSON.stringify({ items: body.items, delivery: body.delivery, expectedTotal: body.expectedTotal })).digest("hex");
    const findExisting = () => supabase.from("orders").select(`${FIELDS},request_hash`)
      .eq("user_id", auth.userId).eq("idempotency_key", body.idempotencyKey).maybeSingle();
    const replay = (row: Record<string, unknown>) => {
      if (row.request_hash !== requestHash) throw new OrderInputError("Энэ хүсэлтээр өөр захиалга бүртгэгдсэн байна. Захиалгын түүхээ шалгана уу.", 409);
      const { request_hash: _hash, ...order } = row;
      return NextResponse.json(order, { headers });
    };
    const existing = await findExisting();
    if (existing.error) throw existing.error;
    if (existing.data) return replay(existing.data);

    const quote = await quoteOrder(body.items, supabase);
    if (quote.total !== body.expectedTotal) {
      return NextResponse.json({ error: "Үнэ өөрчлөгдсөн байна. Шинэ үнийг шалгаад баталгаажуулна уу.", code: "PRICE_CHANGED", quote }, { status: 409, headers });
    }
    // One row stores the order and its immutable line-item snapshot atomically.
    const { data, error } = await supabase.from("orders").insert({
      user_id: auth.userId, idempotency_key: body.idempotencyKey, request_hash: requestHash,
      status: "pending_payment", currency: "MNT", delivery: body.delivery, ...quote,
    }).select(FIELDS).single();
    if (error && ["23505", "P0004", "P0005"].includes(error.code)) {
      const concurrent = await findExisting();
      if (concurrent.error) throw concurrent.error;
      if (concurrent.data) return replay(concurrent.data);
    }
    if (error?.code === "P0004") throw new OrderInputError("Нөөц өөрчлөгдсөн байна. Сагс руу буцаж үлдэгдэл, тоо ширхэгээ шалгана уу.", 409);
    if (error?.code === "P0005") {
      const updatedQuote = await quoteOrder(body.items, supabase);
      return NextResponse.json({ error: "Үнэ өөрчлөгдлөө. Шинэ үнийг шалгаад баталгаажуулна уу.", code: "PRICE_CHANGED", quote: updatedQuote }, { status: 409, headers });
    }
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers });
  } catch (error) {
    return orderError(error);
  }
}

function orderError(error: unknown) {
  if (error instanceof OrderInputError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Хүсэлтийн бүтэц буруу байна." }, { status: 400, headers });
  console.error("[orders] request failed");
  return NextResponse.json({ error: "Захиалгын үйлчилгээ түр боломжгүй байна. Дахин оролдоно уу." }, { status: 503, headers });
}
