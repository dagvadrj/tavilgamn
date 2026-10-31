import { toJson } from "@/lib/supabase/json";
import { NextRequest, NextResponse } from "next/server";
import { parseKitchenGlbReplacement, readKitchenGlbSlots } from "@/lib/kitchenMarketplace";
import { readKitchenDesignUpload } from "@/lib/kitchenDesignModels";
import { readKitchenGlbPlanner } from "@/lib/kitchenGlbPlannerServer";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Swaps the GLB of an editable version of a GLB-sourced design. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => null);
    const input = parseKitchenGlbReplacement(body);
    const model = await readKitchenDesignUpload(auth.userId, input.modelUploadId);
    const slots = readKitchenGlbSlots(body?.materialSlots);
    const { data, error } = await getSupabaseAdmin().rpc("replace_kitchen_marketplace_glb", {
      p_actor: auth.userId,
      p_design: id,
      p_version: input.versionId,
      p_model: toJson(slots ? { ...model, slots } : model),
      p_payload: toJson({
        layout: input.layout,
        cabinetCount: input.cabinetCount,
        planner: readKitchenGlbPlanner(body?.planner),
      }),
    });
    if (error) throw error;
    return NextResponse.json(data, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "GLB загварыг сольж чадсангүй.");
  }
}
