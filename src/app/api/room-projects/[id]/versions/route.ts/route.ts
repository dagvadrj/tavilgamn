import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { UUID_PATTERN } from "@/lib/roomProjectValidation";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const { id } = await params, revision = request.nextUrl.searchParams.get("revision"), before = request.nextUrl.searchParams.get("before");
  if (!UUID_PATTERN.test(id) || [revision, before].some(v => v !== null && !/^[1-9]\d{0,8}$/.test(v)))
    return apiErrorResponse({ error: "Project эсвэл хувилбарын дугаар буруу байна." }, { status: 400, headers });
  let query = getSupabaseAdmin().from("room_project_versions").select(revision ? "revision,name,document,created_at" : "revision,name,created_at")
    .eq("user_id", auth.userId).eq("project_id", id);
  if (revision) {
    const { data, error } = await query.eq("revision", Number(revision)).maybeSingle();
    if (error) return apiErrorResponse({ error: "Хувилбар ачаалагдсангүй." }, { status: 503, headers });
    return data ? NextResponse.json({ version: data }, { headers }) : apiErrorResponse({ error: "Хувилбар олдсонгүй." }, { status: 404, headers });
  }
  if (before) query = query.lt("revision", Number(before));
  const { data, error } = await query.order("revision", { ascending: false }).limit(30);
  return error ? apiErrorResponse({ error: "Түүх ачаалагдсангүй." }, { status: 503, headers }) : NextResponse.json({ versions: data ?? [] }, { headers });
}
