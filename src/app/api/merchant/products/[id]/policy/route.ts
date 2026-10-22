import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id } = await params,
      raw = await request.json().catch(() => null);
    if (
      !/^[\w-]{1,100}$/.test(id) ||
      typeof raw?.enabled !== "boolean" ||
      typeof raw?.expected !== "boolean"
    )
      throw new CatalogInputError("Барааны тохиргоо буруу байна.");
    const { error } = await getSupabaseAdmin().rpc("merchant_product_policy", {
      p_actor: auth.userId,
      p_product: id,
      p_enabled: raw.enabled,
      p_expected: raw.expected,
    });
    if (error) throw error;
    return NextResponse.json(
      { enabled: raw.enabled },
      { headers: merchantHeaders },
    );
  } catch (e) {
    return merchantError(e, "Тохиргоог хадгалж чадсангүй.");
  }
}
