import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";

export const dynamic = "force-dynamic";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const { id, mediaId } = await params;
    const versionId = request.nextUrl.searchParams.get("versionId") ?? "";
    if (![id, mediaId, versionId].every((value) => UUID.test(value)))
      return apiErrorResponse(
        { error: "Зураг болон хувилбарын ID буруу байна." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    const { data, error } = await getSupabaseAdmin().rpc(
      "remove_kitchen_design_media",
      {
        p_actor: auth.userId,
        p_design: id,
        p_version: versionId,
        p_media: mediaId,
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Зургийг устгаж чадсангүй.");
  }
}
