import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Row = {
  id: string;
  created_at: string;
  merchant_order_fulfillments: { subtotal: string; platform_fee: string }[];
};
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  // Up to two years of days, so a one-year view can compare with the year before.
  const days = Number(request.nextUrl.searchParams.get("days") ?? 90);
  if (!Number.isInteger(days) || days < 1 || days > 730)
    return apiErrorResponse(
      { error: "Хугацааны урт буруу байна." },
      { status: 400, headers },
    );
  try {
    const asOf = new Date();
    const today = dayKey(asOf);
    const start = new Date(`${today}T00:00:00+08:00`);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const buckets = new Map<
      string,
      { date: string; net: bigint; gross: bigint; orders: bigint }
    >();
    for (let index = 0; index < days; index++) {
      const day = new Date(start.getTime() + index * 86400000);
      const date = dayKey(day);
      buckets.set(date, { date, net: 0n, gross: 0n, orders: 0n });
    }
    const db = getSupabaseAdmin();
    // Read only the values the chart needs, with deterministic pagination and an explicit cap.
    for (let offset = 0; ; offset += 500) {
      if (offset >= 50000)
        throw new Error("Analytics range exceeds read limit");
      const { data, error } = await db
        .from("orders")
        .select(
          "id,created_at,order_payments!inner(state),merchant_order_fulfillments(subtotal::text,platform_fee::text)",
        )
        .eq("order_payments.state", "paid")
        .gte("created_at", start.toISOString())
        .lte("created_at", asOf.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      for (const row of (data ?? []) as unknown as Row[]) {
        if (!row.merchant_order_fulfillments.length) continue;
        const bucket = buckets.get(dayKey(new Date(row.created_at)));
        if (!bucket) continue;
        bucket.orders++;
        for (const item of row.merchant_order_fulfillments) {
          if (!/^\d+$/.test(item.subtotal) || !/^\d+$/.test(item.platform_fee))
            throw new Error("Invalid analytics amount");
          bucket.gross += BigInt(item.subtotal);
          bucket.net += BigInt(item.platform_fee);
        }
      }
      if ((data?.length ?? 0) < 500) break;
    }
    return NextResponse.json(
      {
        asOf: asOf.toISOString(),
        series: [...buckets.values()].map((row) => ({
          date: row.date,
          net: String(row.net),
          gross: String(row.gross),
          orders: String(row.orders),
        })),
      },
      { headers },
    );
  } catch {
    return apiErrorResponse(
      { error: "Борлуулалтын хандлагыг ачаалж чадсангүй." },
      { status: 503, headers },
    );
  }
}
