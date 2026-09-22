import { NextRequest, NextResponse } from "next/server";
import { readKitchenDesignAction } from "@/lib/kitchenMarketplace";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (!UUID.test(params.id)) return NextResponse.json({ error: "Загварын ID буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    const command = readKitchenDesignAction(await request.json().catch(() => null));
    const db = getSupabaseAdmin();
    const call = command.action === "submit"
      ? db.rpc("submit_kitchen_design", { p_actor: auth.userId, p_design: params.id, p_version: command.versionId })
      : command.action === "publish"
        ? db.rpc("publish_kitchen_design", { p_actor: auth.userId, p_design: params.id, p_version: command.versionId })
        : db.rpc("archive_kitchen_design", { p_actor: auth.userId, p_design: params.id });
    const { error } = await call;
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: kitchenPrivateHeaders });
  } catch (error) {
    return kitchenMarketplaceError(error, "Загварын төлөвийг өөрчилж чадсангүй.");
  }
}
