import type { MerchantInsightsData } from "@/lib/merchantGrowth";

export type InsightPeriod = "day" | "week" | "month";

/** API dates are already Ulaanbaatar calendar dates; use UTC only for date arithmetic. */
export function groupInsightSeries(
  series: MerchantInsightsData["series"],
  period: InsightPeriod,
) {
  const buckets = new Map<
    string,
    { date: string; net: bigint; gross: bigint; orders: bigint }
  >();
  for (const row of series) {
    let key = row.date;
    if (period === "month") key = row.date.slice(0, 7);
    if (period === "week") {
      const date = new Date(`${row.date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      key = date.toISOString().slice(0, 10);
    }
    const bucket = buckets.get(key) ?? {
      date: key,
      net: 0n,
      gross: 0n,
      orders: 0n,
    };
    bucket.net += BigInt(row.net);
    bucket.gross += BigInt(row.gross);
    bucket.orders += BigInt(row.orders);
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      date: row.date,
      net: String(row.net),
      gross: String(row.gross),
      orders: String(row.orders),
    }));
}
