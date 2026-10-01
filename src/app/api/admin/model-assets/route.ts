import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const id = request.nextUrl.searchParams.get("modelId");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return apiErrorResponse({ error: "Model ID шаардлагатай." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("model_assets").select("id,version_id,role,storage_path,state,byte_size,original_name,validation,created_at").eq("model_id", id).order("created_at", { ascending: false }).limit(200);
  if (error) return apiErrorResponse({ error: "Asset түүх ачаалсангүй." }, { status: 503 });
  return NextResponse.json({ assets: data }, { headers: { "Cache-Control": "private, no-store" } });
}
