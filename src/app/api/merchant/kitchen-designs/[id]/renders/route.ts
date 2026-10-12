import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { readKitchenRenderRequest } from "@/lib/kitchenMarketplace";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import {
  CLOUDFLARE_RENDER_MODEL,
  kitchenRenderConfigured,
} from "@/lib/kitchenRenderConfig";
import { cloudinaryImageUploadConfigured } from "@/lib/cloudinaryImageUpload";
import { generateKitchenRender } from "@/lib/generateKitchenRender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = await params;
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (!UUID.test(routeParams.id))
      return apiErrorResponse(
        { error: "Загварын ID буруу байна." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    const render = readKitchenRenderRequest(
      await request.json().catch(() => null),
    );
    const config = {
      provider: "cloudflare" as const,
      model: CLOUDFLARE_RENDER_MODEL,
    };
    if (!kitchenRenderConfigured(config) || !cloudinaryImageUploadConfigured())
      return apiErrorResponse(
        { error: "AI render үйлчилгээ одоогоор бэлэн биш байна." },
        { status: 503, headers: kitchenPrivateHeaders },
      );
    const { data: id, error } = await getSupabaseAdmin().rpc(
      "request_kitchen_render",
      {
        p_actor: auth.userId,
        p_design: routeParams.id,
        p_version: render.versionId,
        p_source_media: render.sourceMediaId,
        p_prompt: render.prompt,
        p_provider: config.provider,
        p_model: config.model,
        p_consent: render.consent,
      },
    );
    if (error) throw error;
    const result = await generateKitchenRender(
      auth.userId,
      id as string,
      config,
    );
    return NextResponse.json(result, {
      status: 201,
      headers: kitchenPrivateHeaders,
    });
  } catch (error) {
    return kitchenMarketplaceError(
      error,
      "AI зураг үүсгэж чадсангүй. Дахин оролдоно уу.",
    );
  }
}
