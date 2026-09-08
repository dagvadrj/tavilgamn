import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

function integerText(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d*)$/.test(value) ||
    value.length > 100
  ) {
    throw new Error("Invalid analytics number");
  }

  return value;
}

function timestamp(value: unknown): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("Invalid analytics timestamp");
  }

  return new Date(value).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set(
        "Cache-Control",
        headers["Cache-Control"],
      );
      return auth.error;
    }

    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_order_analytics",
    );

    if (
      error ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw error ?? new Error("Analytics unavailable");
    }

    const periodStart = timestamp(data.periodStart);
    const asOf = timestamp(data.asOf);

    if (
      Date.parse(asOf) - Date.parse(periodStart) !==
      30 * 24 * 60 * 60 * 1000
    ) {
      throw new Error("Invalid analytics period");
    }

    return NextResponse.json(
      {
        periodStart,
        asOf,
        ordersCreated: integerText(data.ordersCreated),
        paymentsReceived: integerText(data.paymentsReceived),
        grossReceived: integerText(data.grossReceived),
        pendingOrders: integerText(data.pendingOrders),
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Аналитик мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.",
      },
      { status: 503, headers },
    );
  }
}