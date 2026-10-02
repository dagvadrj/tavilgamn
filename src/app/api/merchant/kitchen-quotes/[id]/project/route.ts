import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseKitchen } from "@/lib/kitchenAssembly";
import { apiErrorResponse } from "@/lib/api/errors";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireMerchant(request); if (auth.error) return auth.error;
    const { id } = await params;
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) return apiErrorResponse({ error: "Хүсэлтийн ID буруу байна." }, { status: 400, headers: kitchenPrivateHeaders });
    const db = getSupabaseAdmin();
    const store = await db.from("merchant_stores").select("id").eq("owner_id", auth.userId).eq("active", true).in("store_type", ["factory", "handmade"]).maybeSingle();
    if (store.error) throw store.error;
    if (!store.data) return apiErrorResponse({ error: "Идэвхтэй үйлдвэр эсвэл гар хийцийн дэлгүүр шаардлагатай." }, { status: 403, headers: kitchenPrivateHeaders });
    const result = await db.from("kitchen_quote_requests").select("project_name,project_snapshot")
      .eq("id", id).eq("merchant_owner_id", auth.userId).eq("store_id", store.data.id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return apiErrorResponse({ error: "Үнийн хүсэлт олдсонгүй." }, { status: 404, headers: kitchenPrivateHeaders });
    return NextResponse.json({ name: result.data.project_name, design: parseKitchen(result.data.project_snapshot) }, { headers: kitchenPrivateHeaders });
  } catch (error) { return kitchenMarketplaceError(error, "Илгээсэн загварыг ачаалж чадсангүй."); }
}
