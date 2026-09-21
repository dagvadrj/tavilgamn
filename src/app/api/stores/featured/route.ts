import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control":
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const { data, error } =
      await getSupabaseAdmin().rpc(
        "read_featured_merchants",
        {
          p_limit: 6,
        },
      );

    if (error) throw error;

    return NextResponse.json(
      {
        stores: Array.isArray(data)
          ? data
          : [],
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Онцлох дэлгүүрүүдийг ачаалж чадсангүй.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}