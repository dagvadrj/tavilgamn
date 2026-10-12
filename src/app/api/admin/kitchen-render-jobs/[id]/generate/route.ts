import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { cloudinaryImageUploadConfigured } from "@/lib/cloudinaryImageUpload";
import {
  kitchenMarketplaceError,
  kitchenPrivateHeaders,
} from "@/lib/kitchenMarketplaceHttp";

import { requireAdmin } from "@/lib/supabase/requireAdmin";
import {
  CLOUDFLARE_RENDER_MODEL,
  kitchenRenderConfigured,
  type KitchenRenderConfig,
} from "@/lib/kitchenRenderConfig";
import { generateKitchenRender } from "@/lib/generateKitchenRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const routeParams = await params;
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    if (!UUID.test(routeParams.id))
      return apiErrorResponse(
        { error: "Render job ID буруу байна." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    const approval = await request.json().catch(() => null);
    if (approval?.approveCost !== true)
      return apiErrorResponse(
        { error: "AI render-ийн төлбөртэй үйлдлийг зөвшөөрнө үү." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    if (
      approval.provider !== undefined &&
      !["openai", "cloudflare"].includes(approval.provider)
    )
      return apiErrorResponse(
        { error: "Render provider буруу байна." },
        { status: 400, headers: kitchenPrivateHeaders },
      );
    const override: KitchenRenderConfig | null =
      approval.provider === "cloudflare"
        ? { provider: "cloudflare", model: CLOUDFLARE_RENDER_MODEL }
        : null;
    if (approval.provider === "openai" && !process.env.OPENAI_API_KEY) {
      return apiErrorResponse(
        { error: "OPENAI_API_KEY тохиргоо дутуу байна." },
        { status: 503, headers: kitchenPrivateHeaders },
      );
    }
    if (
      !cloudinaryImageUploadConfigured() ||
      (override && !kitchenRenderConfigured(override))
    ) {
      return apiErrorResponse(
        {
          error:
            "Cloudinary эсвэл Cloudflare render тохиргоо дутуу байна. Workers Free plan-ийг баталгаажуулна уу.",
        },
        { status: 503, headers: kitchenPrivateHeaders },
      );
    }
    const generated = await generateKitchenRender(
      auth.userId,
      routeParams.id,
      override,
    );
    return NextResponse.json(generated, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "AI render үүсгэж чадсангүй.");
  }
}
