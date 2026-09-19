import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import {
  merchantError,
  merchantHeaders,
} from "@/lib/merchantServer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const auth =
      await requireMerchant(request);

    if (auth.error) {
      return auth.error;
    }

    const { data, error } =
      await getSupabaseAdmin().rpc(
        "merchant_dashboard_analytics",
        {
          p_actor: auth.userId,
        },
      );

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        analytics: data ?? null,
      },
      {
        headers: merchantHeaders,
      },
    );
  } catch (error) {
    return merchantError(
      error,
      "Dashboard мэдээллийг ачаалж чадсангүй.",
    );
  }
}