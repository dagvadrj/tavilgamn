import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("phase6_readiness");
    if (error || data !== true) throw new Error("NOT_READY");
    const room = await getSupabaseAdmin().rpc("phase8_readiness");
    if (room.error || room.data !== true) throw new Error("ROOM_NOT_READY");
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiErrorResponse({ error: "Service not ready" }, { status: 503 });
  }
}
