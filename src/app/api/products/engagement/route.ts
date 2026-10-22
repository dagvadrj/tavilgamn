import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 2048)
    return new NextResponse(null, { status: 413 });
  const raw = await request.json().catch(() => null);
  if (
    !raw ||
    !uuid.test(raw.id) ||
    !uuid.test(raw.sessionId) ||
    typeof raw.productId !== "string" ||
    !/^[\w-]{1,100}$/.test(raw.productId) ||
    !["placement", "color", "material"].includes(raw.kind) ||
    typeof raw.option !== "string" ||
    raw.option.length > 100
  )
    return new NextResponse(null, { status: 400 });
  const { error } = await getSupabaseAdmin().rpc("record_product_3d_event", {
    p_id: raw.id,
    p_session: raw.sessionId,
    p_product: raw.productId,
    p_kind: raw.kind,
    p_option: raw.option,
  });
  return new NextResponse(null, {
    status: error ? 503 : 204,
    headers: { "Cache-Control": "no-store" },
  });
}
