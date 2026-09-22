import { NextRequest, NextResponse } from "next/server";
import { parseKitchenMarketplaceDraft } from "@/lib/kitchenMarketplace";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { readMerchantKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    return NextResponse.json(await readMerchantKitchenDesigns(auth.userId), { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Гал тогооны загваруудыг ачаалж чадсангүй.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const draft = parseKitchenMarketplaceDraft(await request.json().catch(() => null));
    const { data, error } = await getSupabaseAdmin().rpc("create_kitchen_marketplace_design", {
      p_actor: auth.userId,
      p_source_id: draft.sourceKitchenId,
      p_slug: draft.slug,
      p_payload: draft.payload,
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Гал тогооны загварын draft үүсгэж чадсангүй.");
  }
}
