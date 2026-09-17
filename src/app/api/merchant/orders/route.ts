import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantObject } from "@/lib/merchantValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const page = Number(new URL(request.url).searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000) throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc("read_merchant_orders", { p_actor: auth.userId, p_page: page });
    if (error) throw error;
    return NextResponse.json({ orders: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Захиалгуудыг ачаалж чадсангүй."); }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const raw = merchantObject(await request.json().catch(() => { throw new CatalogInputError("JSON буруу байна."); }));
    if (typeof raw.id !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(raw.id)
      || typeof raw.status !== "string" || !["processing", "shipped", "delivered"].includes(raw.status)
      || typeof raw.expectedStatus !== "string" || !["pending", "processing", "shipped", "delivered"].includes(raw.expectedStatus)) throw new CatalogInputError("Захиалгын төлөв буруу байна.");
    const { error } = await getSupabaseAdmin().rpc("update_merchant_order", {
      p_actor: auth.userId, p_order: raw.id, p_status: raw.status, p_expected_status: raw.expectedStatus,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Захиалгын төлөв хадгалагдсангүй."); }
}
