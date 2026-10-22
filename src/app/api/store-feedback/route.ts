import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams, store = q.get("store"), product = q.get("product");
  if ((!store && !product) || (store?.length ?? 0) > 200 || (product?.length ?? 0) > 150) return apiErrorResponse({ error: "Дэлгүүр эсвэл бараа сонгоно уу." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().rpc("public_store_feedback", { ...(store ? { p_store: store } : {}), ...(product ? { p_product: product } : {}) });
  if (error) return apiErrorResponse({ error: "Мэдээлэл ачаалах боломжгүй байна." }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
