import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { KitchenMarketplaceInputError } from "@/lib/kitchenMarketplace";
import { kitchenMarketplaceError, kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser(request); if (auth.error) return auth.error;
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      typeof body?.note !== "string" || !body.note.trim() || body.note.length > 5000) throw new KitchenMarketplaceInputError("Цуцлах шалтгаан эсвэл хүсэлтийн ID буруу байна.");
    const { error } = await getSupabaseAdmin().rpc("cancel_kitchen_render", { p_actor: auth.userId, p_job: id, p_note: body.note.trim() });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: kitchenPrivateHeaders });
  } catch (error) { return kitchenMarketplaceError(error, "Хүсэлтийг цуцалж чадсангүй."); }
}
