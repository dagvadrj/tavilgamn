import { NextRequest, NextResponse } from "next/server";
import { CatalogInputError } from "@/lib/catalogValidation";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    const raw = await request.json().catch(() => null);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || typeof raw?.archived !== "boolean") {
      throw new CatalogInputError("Бараа болон архивын төлөв буруу байна.");
    }
    const { error } = await getSupabaseAdmin().rpc("set_merchant_product_archived", {
      p_actor: auth.userId, p_product: id, p_archived: raw.archived,
    });
    if (error) throw error;
    return NextResponse.json({ archived: raw.archived }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Барааны архивын төлөвийг өөрчилж чадсангүй."); }
}
