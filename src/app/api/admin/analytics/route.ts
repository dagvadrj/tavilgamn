import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

function integerText(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9]\d*)$/.test(value)
  ) {
    throw new Error(
      "Invalid analytics number",
    );
  }

  return value;
}

function timestamp(
  value: unknown,
): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(
      Date.parse(value),
    )
  ) {
    throw new Error(
      "Invalid analytics timestamp",
    );
  }

  return new Date(
    value,
  ).toISOString();
}

type MerchantRow = {
  id: string;
  name: string;
  image: string;
  commissionBps: number;

  grossRevenue: string;
  platformRevenue: string;
  merchantNet: string;
  orders: string;
};

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set(
        "Cache-Control",
        headers["Cache-Control"],
      );

      return auth.error;
    }

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "admin_marketplace_analytics",
        {
          p_actor: auth.userId,
        },
      );

    if (
      error ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw (
        error ??
        new Error(
          "Analytics unavailable",
        )
      );
    }

    const raw =
      data as Record<
        string,
        unknown
      >;

    const topMerchants =
      Array.isArray(
        raw.topMerchants,
      )
        ? raw.topMerchants
        : [];

    const merchants: MerchantRow[] =
      topMerchants.map(
        (entry) => {
          if (
            !entry ||
            typeof entry !==
              "object" ||
            Array.isArray(entry)
          ) {
            throw new Error(
              "Invalid merchant analytics",
            );
          }

          const row =
            entry as Record<
              string,
              unknown
            >;

          if (
            typeof row.id !==
              "string" ||
            typeof row.name !==
              "string"
          ) {
            throw new Error(
              "Invalid merchant",
            );
          }

          return {
            id: row.id,

            name: row.name,

            image:
              typeof row.image ===
              "string"
                ? row.image
                : "",

            commissionBps:
              typeof row.commissionBps ===
              "number"
                ? row.commissionBps
                : 500,

            grossRevenue:
              integerText(
                row.grossRevenue,
              ),

            platformRevenue:
              integerText(
                row.platformRevenue,
              ),

            merchantNet:
              integerText(
                row.merchantNet,
              ),

            orders:
              integerText(
                row.orders,
              ),
          };
        },
      );

    return NextResponse.json(
      {
        periodStart:
          timestamp(
            raw.periodStart,
          ),

        asOf:
          timestamp(raw.asOf),

        gmv:
          integerText(raw.gmv),

        platformRevenue:
          integerText(
            raw.platformRevenue,
          ),

        merchantNet:
          integerText(
            raw.merchantNet,
          ),

        paidOrders:
          integerText(
            raw.paidOrders,
          ),

        totalMerchants:
          integerText(
            raw.totalMerchants,
          ),

        activeMerchants:
          integerText(
            raw.activeMerchants,
          ),

        featuredMerchants:
          integerText(
            raw.featuredMerchants,
          ),

        openModelRequests:
          integerText(
            raw.openModelRequests,
          ),

        topMerchants:
          merchants,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Marketplace аналитик мэдээллийг ачаалж чадсангүй.",
      },
      {
        status: 503,
        headers,
      },
    );
  }
}