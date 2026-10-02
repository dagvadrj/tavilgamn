import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse, privateHeaders } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const db = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const checks = await Promise.all([
      db.from("order_cancellations").select("order_id", { count: "exact", head: true }).eq("status", "requested"),
      db.from("order_payments").select("order_id", { count: "exact", head: true }).or("requires_review.eq.true,state.eq.needs_review"),
      db.from("product_media_assets").select("id", { count: "exact", head: true }).in("state", ["uploading", "ready", "failed"]).lt("created_at", cutoff),
      db.from("product_media_assets").select("id", { count: "exact", head: true }).eq("state", "retained"),
    ]);
    if (checks.some(result => result.error || result.count == null)) throw new Error("Incomplete commerce health");
    return NextResponse.json({ cancellationRequests: checks[0].count, paymentReviews: checks[1].count, unsettledMedia: checks[2].count, retainedMedia: checks[3].count, checkedAt: new Date().toISOString() }, { headers: privateHeaders });
  } catch {
    return apiErrorResponse({ error: "Худалдааны хяналтын мэдээлэл ачаалсангүй." }, { status: 503, headers: privateHeaders });
  }
}
