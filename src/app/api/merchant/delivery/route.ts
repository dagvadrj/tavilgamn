import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { CatalogInputError } from "@/lib/catalogValidation";
import {
  parseDeliveryMove,
  parseDeliveryStage,
} from "@/lib/merchantDeliveryValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const params = new URL(request.url).searchParams,
      stage = parseDeliveryStage(params.get("stage")),
      page = Number(params.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 100000)
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "read_merchant_delivery_orders",
      { p_actor: auth.userId, p_stage: stage, p_page: page },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(error, "Хүргэлтийн захиалгуудыг ачаалж чадсангүй.");
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const input = parseDeliveryMove(
      await request.json().catch(() => {
        throw new CatalogInputError("JSON буруу байна.");
      }),
    );
    const { data, error } = await getSupabaseAdmin().rpc(
      "move_showroom_delivery",
      {
        p_actor: auth.userId,
        p_data: input,
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(
      error,
      "Хүргэлтийн төлөв хадгалагдсангүй. Жагсаалтаа шинэчилнэ үү.",
    );
  }
}
