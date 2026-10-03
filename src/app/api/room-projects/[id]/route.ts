import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { readBoundedJson } from "@/lib/boundedJson";
import { UUID_PATTERN } from "@/lib/roomProjectValidation";
import { enforceApiRateLimit } from "@/lib/rateLimit";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return apiErrorResponse({ error: "Project ID буруу байна." }, { status: 400, headers });
  const { data, error } = await getSupabaseAdmin().from("room_projects").select("id,name,document,revision,room_count,piece_count,import_key,archived_at,created_at,updated_at")
    .eq("user_id", auth.userId).eq("id", id).maybeSingle();
  if (error) return apiErrorResponse({ error: "Загвар ачаалагдсангүй." }, { status: 503, headers });
  return data ? NextResponse.json({ project: data }, { headers }) : apiErrorResponse({ error: "Загвар олдсонгүй." }, { status: 404, headers });
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const rateLimitResponse = await enforceApiRateLimit(request, auth.userId);
  if (rateLimitResponse) return rateLimitResponse;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return apiErrorResponse({ error: "Project ID буруу байна." }, { status: 400, headers });
  try {
    const body = await readBoundedJson(request) as { archived?: unknown; expectedRevision?: unknown };
    if (!body || typeof body.archived !== "boolean" || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 1)
      return apiErrorResponse({ error: "Архивын хүсэлт буруу байна." }, { status: 400, headers });
    const { data, error } = await getSupabaseAdmin().rpc("archive_room_project", { p_actor: auth.userId, p_id: id,
      p_expected_revision: Number(body.expectedRevision), p_archived: body.archived });
    if (error?.code === "40001") return apiErrorResponse({ error: "Загвар өөр tab-д шинэчлэгдсэн. Жагсаалтаа дахин ачаална уу." }, { status: 409, headers });
    if (error?.code === "P0002") return apiErrorResponse({ error: "Загвар олдсонгүй." }, { status: 404, headers });
    return error ? apiErrorResponse({ error: "Архивын төлөв өөрчилж чадсангүй." }, { status: 503, headers }) : NextResponse.json({ project: data }, { headers });
  } catch { return apiErrorResponse({ error: "Архивын хүсэлт буруу байна." }, { status: 400, headers }); }
}
