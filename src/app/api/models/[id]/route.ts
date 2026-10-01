import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
async function archive(request: NextRequest, params: Promise<{ id: string }>, archived: boolean) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiErrorResponse({ error: "Model ID буруу." }, { status: 400 });
  const { error } = await getSupabaseAdmin().rpc("set_model_archived", { p_actor: auth.userId, p_model: id, p_archived: archived });
  if (error) return apiErrorResponse({ error: "Model-ийн архивын төлөв өөрчилж чадсангүй." }, { status: error.code === "P0002" ? 404 : 503 });
  return NextResponse.json({ success: true, archived }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return archive(request, params, true); }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return archive(request, params, false); }
