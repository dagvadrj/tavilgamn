import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { UUID_PATTERN } from "@/lib/roomProjectValidation";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request); if (auth.error) return auth.error;
  const { id } = await params, headers = { "Cache-Control": "private, no-store" };
  if (!UUID_PATTERN.test(id)) return apiErrorResponse({ error: "Загварын ID буруу байна." }, { status: 400, headers });
  const { data, error } = await getSupabaseAdmin().from("kitchen_garnitures")
    .select("id,name,design,thumbnail_url,revision,source_marketplace_design_id,source_marketplace_version_id,created_at,updated_at")
    .eq("user_id", auth.userId).eq("id", id).maybeSingle();
  if (error) return apiErrorResponse({ error: "Загвар ачаалагдсангүй." }, { status: 503, headers });
  return data ? NextResponse.json({ kitchen: data }, { headers }) : apiErrorResponse({ error: "Загвар олдсонгүй." }, { status: 404, headers });
}
