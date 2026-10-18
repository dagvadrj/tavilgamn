import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { CatalogInputError } from "@/lib/catalogValidation";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const params = new URL(request.url).searchParams,
      section = params.get("section"),
      date = params.get("date"),
      page = Number(params.get("page") ?? 0);
    if (section !== "progress" && section !== "trends")
      throw new CatalogInputError("Статистикийн төрөл буруу байна.");
    if (
      !Number.isInteger(page) ||
      page < 0 ||
      page > 100000 ||
      (date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date))
    )
      throw new CatalogInputError("Огноо эсвэл хуудас буруу байна.");
    const { data, error } =
      section === "progress"
        ? await getSupabaseAdmin().rpc("merchant_dashboard_progress", {
            p_actor: auth.userId,
            ...(date ? { p_date: date } : {}),
            p_page: page,
          })
        : await getSupabaseAdmin().rpc("merchant_dashboard_trends", {
            p_actor: auth.userId,
          });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (reason) {
    return merchantError(reason, "Статистикийг ачаалж чадсангүй.");
  }
}
