import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const page = Number(request.nextUrl.searchParams.get("page") ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000) return NextResponse.json({error: "Хуудас буруу байна."}, {status: 400, headers});
    const { data, error } = await getSupabaseAdmin().from("contact_messages").select("id,name,email,message,created_at")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * 20, page * 20 + 20);
    if (error) throw error;
    return NextResponse.json({ messages: (data ?? []).slice(0, 20), hasMore: (data?.length ?? 0) > 20 }, { headers });
  } catch { return NextResponse.json({error: "Зурвасуудыг ачаалж чадсангүй."}, {status: 503, headers}); }
}
