import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantImportTemplate } from "@/lib/merchantExcel";
import { documentResponse, commerceError } from "@/lib/merchantCommerceServer";
import {
  importErrorsResponse,
  importPreview,
  isImportUpload,
  previewRow,
  readImportJson,
  validProducts,
} from "@/lib/productImportServer";
import { merchantHeaders } from "@/lib/merchantServer";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    return documentResponse(
      await merchantImportTemplate(),
      "merchant-product-template",
      "xlsx",
    );
  } catch (error) {
    return commerceError(error, "Excel загварыг үүсгэж чадсангүй.");
  }
}
/** multipart = preview the uploaded file; JSON = commit edited rows or download failed rows. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (isImportUpload(request))
      return NextResponse.json(await importPreview(request), {
        headers: { ...merchantHeaders, "X-Merchant-Mutation": "none" },
      });
    const body = await readImportJson(request);
    if (body.mode === "errors") return importErrorsResponse(body.rows);
    if (body.mode === "validate")
      return NextResponse.json({ rows: body.rows.map(previewRow) }, { headers: { ...merchantHeaders, "X-Merchant-Mutation": "none" } });
    // A merchant always imports into their own store; the RPC derives it from the actor.
    if (body.storeId !== undefined)
      throw new CatalogInputError("Импортын хүсэлт буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "import_merchant_products",
      {
        p_actor: auth.userId,
        p_request: body.requestId,
        p_hash: body.hash,
        p_products: toJson(validProducts(body.rows)),
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Барааны импорт амжилтгүй боллоо.");
  }
}
