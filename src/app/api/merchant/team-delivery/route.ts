import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { parseDeliveryMove, parseDeliveryStage } from "@/lib/merchantDeliveryValidation";
import { CatalogInputError } from "@/lib/catalogValidation";
export const dynamic = "force-dynamic";
async function run(request: NextRequest, write: boolean) {
  try {
    const auth = await authorize(request); if (auth.error) return auth.error;
    const q = new URL(request.url).searchParams;
    let action = q.get("staff") === "1" ? "staff" : "read";
    let input;
    if (write) { action = "move"; input = parseDeliveryMove(await request.json()); }
    else {
      const page = Number(q.get("page") ?? 0);
      if (!Number.isInteger(page) || page < 0 || page > 100000) throw new CatalogInputError("Хуудас буруу байна.");
      input = action === "staff" ? {} : { stage: parseDeliveryStage(q.get("stage")), page };
    }
    const { data, error } = await getSupabaseAdmin().rpc("staff_delivery", { p_actor: auth.userId, p_action: action, p_data: input });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (e) { return merchantError(e, "Хүргэлтийн мэдээллийг шинэчилж чадсангүй."); }
}
export const GET = (r: NextRequest) => run(r, false);
export const PATCH = (r: NextRequest) => run(r, true);
