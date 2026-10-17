import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { readKitchenReview } from "@/lib/kitchenMarketplace";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";
import { readAdminKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import {
  configuredKitchenRender,
  kitchenRenderConfigured,
} from "@/lib/kitchenRenderConfig";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const designId = request.nextUrl.searchParams.get("design");
    if (
      designId &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        designId,
      )
    )
      return apiErrorResponse(
        { error: "Загварын дугаар буруу байна." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    const config = configuredKitchenRender();
    const designs = await readAdminKitchenDesigns(
      undefined,
      designId ?? undefined,
    );
    if (designId && designs.length === 0)
      return apiErrorResponse(
        { error: "Загвар олдсонгүй." },
        { status: 404, headers: kitchenPrivateHeaders },
      );
    return NextResponse.json(
      {
        designs,
        renderConfig: { ...config, ready: kitchenRenderConfigured(config) },
      },
      { headers: kitchenPrivateHeaders },
    );
  } catch (error) {
    return kitchenMarketplaceError(
      error,
      "Гал тогооны загваруудыг ачаалж чадсангүй.",
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const review = readKitchenReview(await request.json().catch(() => null));
    const { error } = await getSupabaseAdmin().rpc("review_kitchen_design", {
      p_actor: auth.userId,
      p_design: review.designId,
      p_version: review.versionId,
      p_action: review.action,
      p_note: review.note,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(
      error,
      "Хяналтын шийдвэрийг хадгалж чадсангүй.",
    );
  }
}
