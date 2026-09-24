import { NextRequest, NextResponse } from "next/server";
import { CatalogInputError } from "@/lib/catalogValidation";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/requireUser";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000) {
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    }
    const { data, error } = await getSupabaseAdmin().rpc(
      "read_customer_kitchen_quotes",
      { p_actor: auth.userId, p_page: page },
    );
    if (error) throw error;
    return NextResponse.json(
      { quotes: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 },
      { headers: kitchenPrivateHeaders },
    );
  } catch (error) {
    return kitchenMarketplaceError(error, "Үнийн хүсэлтүүдийг ачаалж чадсангүй.");
  }
}
