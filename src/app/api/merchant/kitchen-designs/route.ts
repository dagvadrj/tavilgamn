import { toJson } from "@/lib/supabase/json";
import { NextRequest, NextResponse } from "next/server";
import {
  parseKitchenMarketplaceDraft,
  parseKitchenMarketplaceGlbDraft,
  readKitchenGlbSlots,
} from "@/lib/kitchenMarketplace";
import { readKitchenDesignUpload } from "@/lib/kitchenDesignModels";
import { readKitchenGlbPlanner } from "@/lib/kitchenGlbPlannerServer";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { readMerchantKitchenDesigns } from "@/lib/kitchenMarketplaceServer";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const runtime = "nodejs";
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
    const body = await request.json().catch(() => null);
    if (body?.source === "glb") {
      const glb = parseKitchenMarketplaceGlbDraft(body);
      const model = await readKitchenDesignUpload(auth.userId, glb.modelUploadId);
      const slots = readKitchenGlbSlots(body.materialSlots);
      const { data, error } = await getSupabaseAdmin().rpc("create_kitchen_marketplace_glb_design", {
        p_actor: auth.userId,
        p_slug: glb.slug,
        p_payload: toJson({ ...glb.payload, planner: readKitchenGlbPlanner(body.planner) }),
        p_model: toJson(slots ? { ...model, slots } : model),
      });
      if (error) throw error;
      return NextResponse.json(data, { status: 201, headers: kitchenPrivateHeaders });
    }
    const draft = parseKitchenMarketplaceDraft(body);
    const { data, error } = await getSupabaseAdmin().rpc("create_kitchen_marketplace_design", {
      p_actor: auth.userId,
      p_source_id: draft.sourceKitchenId,
      p_slug: draft.slug,
      p_payload: toJson(draft.payload),
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Гал тогооны загварын draft үүсгэж чадсангүй.");
  }
}
