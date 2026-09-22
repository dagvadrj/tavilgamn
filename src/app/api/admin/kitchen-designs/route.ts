import { NextRequest, NextResponse } from "next/server";
import { readKitchenReview } from "@/lib/kitchenMarketplace";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { readAdminKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    return NextResponse.json({ designs: await readAdminKitchenDesigns() }, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Гал тогооны загваруудыг ачаалж чадсангүй.");
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
    return kitchenMarketplaceError(error, "Хяналтын шийдвэрийг хадгалж чадсангүй.");
  }
}
