import { NextRequest, NextResponse } from "next/server";
import { readKitchenRenderRequest } from "@/lib/kitchenMarketplace";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_MODELS = new Set(["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"]);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (!UUID.test(params.id)) return NextResponse.json({ error: "Загварын ID буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    const render = readKitchenRenderRequest(await request.json().catch(() => null));
    const configuredModel = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2.5-sunburst";
    const model = IMAGE_MODELS.has(configuredModel) ? configuredModel : "gpt-image-2.5-sunburst";
    const { data: id, error } = await getSupabaseAdmin().rpc("request_kitchen_render", {
      p_actor: auth.userId, p_design: params.id, p_version: render.versionId,
      p_source_media: render.sourceMediaId, p_prompt: render.prompt, p_provider: "openai", p_model: model,
    });
    if (error) throw error;
    return NextResponse.json({ id, status: "queued" }, { status: 201, headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "AI render хүсэлтийг хадгалж чадсангүй.");
  }
}
