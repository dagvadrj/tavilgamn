import { NextRequest } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { CATEGORIES } from "@/lib/catalogCategories";
import type { ProductExport } from "@/lib/merchantCommerce";
import { documentResponse, commerceError } from "@/lib/merchantCommerceServer";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const params = request.nextUrl.searchParams,
      format = params.get("format"),
      category = params.get("category") ?? "",
      search = (params.get("search") ?? "").trim(),
      archived = params.get("archived");
    if (
      !["xlsx", "pdf"].includes(format ?? "") ||
      (category &&
        !CATEGORIES.some(
          (c) => c.id === category && c.id !== "kitchen-cabinet",
        )) ||
      search.length > 100 ||
      (archived !== null && archived !== "1")
    )
      throw new CatalogInputError("Экспортын шүүлтүүр буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "merchant_product_export",
      {
        p_actor: auth.userId,
        p_category: category,
        p_search: search,
        p_archived: archived === "1",
      },
    );
    if (error) throw error;
    const result: ProductExport = {
      rows: data as unknown as ProductExport["rows"],
      category,
      search,
      includeArchived: archived === "1",
      generatedAt: new Date().toISOString(),
    };
    const bytes =
      format === "xlsx"
        ? await (
            await import("@/lib/merchantDocuments")
          ).merchantProductsExcel(result)
        : await (await import("@/lib/merchantPdf")).merchantProductsPdf(result);
    return documentResponse(
      bytes,
      `baraa-${category || "all"}`,
      format === "xlsx" ? "xlsx" : "pdf",
    );
  } catch (error) {
    return commerceError(error, "Барааны жагсаалтыг экспортлож чадсангүй.");
  }
}
