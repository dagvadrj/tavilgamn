import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { CatalogInputError } from "@/lib/catalogValidation";
import { parseDeliveryStaff } from "@/lib/merchantDeliveryValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { data, error } = await getSupabaseAdmin().rpc(
      "read_merchant_delivery_staff",
      { p_actor: auth.userId },
    );
    if (error) throw error;
    return NextResponse.json({ staff: data }, { headers: merchantHeaders });
  } catch (error) {
    return merchantError(error, "Хүргэлтийн ажилтнуудыг ачаалж чадсангүй.");
  }
}
async function save(request: NextRequest, creating: boolean) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const input = parseDeliveryStaff(
      await request.json().catch(() => {
        throw new CatalogInputError("JSON буруу байна.");
      }),
      creating,
    );
    const { data, error } = await getSupabaseAdmin().rpc(
      "save_merchant_delivery_staff",
      {
        p_actor: auth.userId,
        p_id: input.id,
        p_expected_version: input.expectedVersion,
        p_name: input.name,
        p_phone: input.phone,
        p_vehicle: input.vehicle,
        p_active: input.active,
      },
    );
    if (error) throw error;
    return NextResponse.json(data, {
      status: creating ? 201 : 200,
      headers: merchantHeaders,
    });
  } catch (error) {
    return merchantError(error, "Хүргэлтийн ажилтны мэдээлэл хадгалагдсангүй.");
  }
}
export const POST = (request: NextRequest) => save(request, true);
export const PUT = (request: NextRequest) => save(request, false);
