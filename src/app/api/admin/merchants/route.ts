import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

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

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "admin_merchant_overview",
        {
          p_actor: auth.userId,
        },
      );

    if (error) throw error;

    return NextResponse.json(
      {
        merchants: Array.isArray(data)
          ? data
          : [],
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Merchant мэдээллийг ачаалж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}

export async function PATCH(
  request: NextRequest,
) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set(
        "Cache-Control",
        headers["Cache-Control"],
      );

      return auth.error;
    }

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object" ||
      typeof body.id !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Merchant мэдээлэл буруу байна.",
        },
        {
          status: 400,
          headers,
        },
      );
    }

    const commissionBps =
      Number(body.commissionBps);

    if (
      !Number.isInteger(commissionBps) ||
      commissionBps < 300 ||
      commissionBps > 500
    ) {
      return NextResponse.json(
        {
          error:
            "Commission 3%–5% хооронд байна.",
        },
        {
          status: 400,
          headers,
        },
      );
    }

    const isFeatured =
      body.isFeatured === true;

 let featuredRank: number | null = null;

if (isFeatured) {
  const rank = Number(body.featuredRank);

  if (
    !Number.isInteger(rank) ||
    rank < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Featured merchant-ийн эрэмбэ 1-ээс эхэлнэ.",
      },
      {
        status: 400,
        headers,
      },
    );
  }

  featuredRank = rank;
}

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        {
          error:
            "Merchant төлөв буруу байна.",
        },
        {
          status: 400,
          headers,
        },
      );
    }

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "admin_update_merchant_settings",
        {
          p_actor: auth.userId,
          p_store_id: body.id,
          p_commission_bps: commissionBps,
          p_is_featured: isFeatured,
          p_featured_rank: featuredRank,
          p_active: body.active,
        },
      );

    if (error) {
      if (
        error.message?.includes(
          "duplicate key",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Featured эрэмбэ давхцаж байна.",
          },
          {
            status: 409,
            headers,
          },
        );
      }

      throw error;
    }

    return NextResponse.json(
      {
        merchant: data,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Merchant тохиргоог хадгалж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}