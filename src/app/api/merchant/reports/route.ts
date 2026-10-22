import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import {
  reportingPeriod,
  reportTotals,
  type MerchantReport,
} from "@/lib/merchantCommerce";
import { documentResponse, commerceError } from "@/lib/merchantCommerceServer";
import { merchantHeaders } from "@/lib/merchantServer";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const params = request.nextUrl.searchParams,
      { from, to } = reportingPeriod(params.get("from"), params.get("to")),
      format = params.get("format");
    if (format && !["xlsx", "pdf"].includes(format))
      throw new CatalogInputError("Тайлангийн формат буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc("merchant_report", {
      p_actor: auth.userId,
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    const report = data as unknown as MerchantReport;
    if (format === "xlsx" || format === "pdf") {
      const bytes =
        format === "xlsx"
          ? await (
              await import("@/lib/merchantDocuments")
            ).merchantReportExcel(report)
          : await (await import("@/lib/merchantPdf")).merchantReportPdf(report);
      return documentResponse(bytes, `merchant-report-${from}-${to}`, format);
    }
    return NextResponse.json(
      { report, totals: reportTotals(report) },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return commerceError(error, "Тайланг үүсгэж чадсангүй.");
  }
}
