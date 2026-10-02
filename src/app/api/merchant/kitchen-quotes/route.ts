import { jsonArray } from "@/lib/supabase/json";
import { NextRequest, NextResponse } from "next/server";
import { CatalogInputError } from "@/lib/catalogValidation";
import { readMerchantKitchenQuoteUpdate } from "@/lib/kitchenQuotes";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000) {
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    }
    const focus = new URL(request.url).searchParams.get("quote");
    if (focus && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(focus)) throw new CatalogInputError("Хүсэлтийн ID буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "read_merchant_kitchen_quotes",
      { p_actor: auth.userId, p_page: focus ? 0 : page, ...(focus ? { p_focus: focus } : {}) },
    );
    if (error) throw error;
    return NextResponse.json(
      { quotes: jsonArray(data).slice(0, 20), hasMore: jsonArray(data).length > 20 },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return merchantError(error, "Үнийн хүсэлтүүдийг ачаалж чадсангүй.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const input = readMerchantKitchenQuoteUpdate(
      await request.json().catch(() => null),
    );
    const { error } = await getSupabaseAdmin().rpc(
      "update_merchant_kitchen_quote",
      {
        p_actor: auth.userId,
        p_quote: input.id,
        p_status: input.status,
        p_expected_status: input.expectedStatus,
        p_price: input.quotedPrice,
        p_note: input.note,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(error, "Үнийн хүсэлтийн төлөвийг хадгалж чадсангүй.");
  }
}
