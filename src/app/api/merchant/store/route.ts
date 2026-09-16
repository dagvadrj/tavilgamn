import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { CatalogInputError } from "@/lib/catalogValidation";
import { parseMerchantStore } from "@/lib/merchantValidation";
import { merchantError, merchantHeaders, merchantStoreFromRow } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().rpc("read_merchant_store", { p_actor: auth.userId });
    if (error) throw error;
    return NextResponse.json({ store: data ? merchantStoreFromRow(data) : null }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Дэлгүүрийн мэдээллийг ачаалж чадсангүй."); }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const raw = await request.json().catch(() => { throw new CatalogInputError("JSON буруу байна."); });
    const store = parseMerchantStore(raw);
    const { data, error } = await getSupabaseAdmin().rpc("save_merchant_store", { p_actor: auth.userId, p_data: store });
    if (error) throw error;
    return NextResponse.json({ store: merchantStoreFromRow(data) }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Дэлгүүрийн мэдээллийг хадгалж чадсангүй."); }
}
