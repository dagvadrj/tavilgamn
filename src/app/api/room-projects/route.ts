import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { apiErrorResponse } from "@/lib/api/errors";
import { readBoundedJson } from "@/lib/boundedJson";
import { parseRoomSave, RoomProjectInputError, ROOM_PROJECT_MAX_BYTES, UUID_PATTERN } from "@/lib/roomProjectValidation";
import { enforceApiRateLimit } from "@/lib/rateLimit";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const columns = "id,name,revision,room_count,piece_count,import_key,archived_at,created_at,updated_at";
export async function GET(request: NextRequest) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  try {
    const cursor = request.nextUrl.searchParams.get("cursor"), archived = request.nextUrl.searchParams.get("archived");
    if (archived !== null && archived !== "1") throw new RoomProjectInputError("Архивын сонголт буруу байна.");
    let query = getSupabaseAdmin().from("room_projects").select(columns).eq("user_id", auth.userId);
    query = archived === "1" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
    if (cursor) {
      if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new RoomProjectInputError("Хуудасны cursor буруу байна.");
      const after = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (typeof after.id !== "string" || !UUID_PATTERN.test(after.id) || typeof after.at !== "string"
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(after.at) || !Number.isFinite(Date.parse(after.at)))
        throw new RoomProjectInputError("Хуудасны cursor буруу байна.");
      query = query.or(`updated_at.lt.${after.at},and(updated_at.eq.${after.at},id.lt.${after.id})`);
    }
    const { data, error } = await query.order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(31);
    if (error) return apiErrorResponse({ error: "Өрөөний загварууд ачаалагдсангүй." }, { status: 503, headers });
    const items = (data ?? []).slice(0, 30), last = items.at(-1);
    const nextCursor = data && data.length > 30 && last ? Buffer.from(JSON.stringify({ at: last.updated_at, id: last.id })).toString("base64url") : null;
    return NextResponse.json({ projects: items, nextCursor }, { headers });
  } catch { return apiErrorResponse({ error: "Хуудасны тохиргоо буруу байна." }, { status: 400, headers }); }
}
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const rateLimitResponse = await enforceApiRateLimit(request, auth.userId);
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const body = parseRoomSave(await readBoundedJson(request, ROOM_PROJECT_MAX_BYTES));
    const { data, error } = await getSupabaseAdmin().rpc("save_room_project", { p_actor: auth.userId, p_id: body.id,
      p_name: body.name, p_document: toJson(body.document), p_expected_revision: body.expectedRevision,
      p_operation: body.operationId, p_import_key: body.importKey, p_force_version: body.forceVersion });
    if (error?.code === "40001" || error?.code === "55000") return apiErrorResponse({ error: "Загвар шинэчлэгдсэн эсвэл архивлагдсан байна. Local өөрчлөлтөө хуулбар болгон хадгалах эсвэл хамгийн сүүлийн загварыг нээнэ үү." }, { status: 409, headers });
    if (error?.code === "22023") return apiErrorResponse({ error: "Хадгалалтын хүсэлтийн утга эсвэл retry key буруу байна." }, { status: 400, headers });
    if (error || !data) return apiErrorResponse({ error: "Cloud хадгалалт боломжгүй байна. Local өөрчлөлт тань хэвээр." }, { status: 503, headers });
    return NextResponse.json(data, { headers });
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
    return apiErrorResponse({ error: tooLarge ? "Загварын өгөгдөл 1 MB-ээс хэтэрсэн байна." : error instanceof RoomProjectInputError ? error.message : "Өрөөний өгөгдөл буруу байна." }, { status: tooLarge ? 413 : 400, headers });
  }
}
