import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import {
  IMPORT_BYTES,
  merchantImportTemplate,
  parseMerchantWorkbook,
} from "@/lib/merchantExcel";
import {
  documentResponse,
  limitedBody,
  commerceError,
} from "@/lib/merchantCommerceServer";
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
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const bytes = await limitedBody(request, IMPORT_BYTES + 64000);
    let form: FormData;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      }).formData();
    } catch {
      throw new CatalogInputError("Excel файлаа дахин сонгоно уу.");
    }
    const file = form.get("file"),
      requestId = form.get("requestId"),
      mode = form.get("mode");
    if (
      !(file instanceof File) ||
      !/\.xlsx$/i.test(file.name) ||
      file.size > IMPORT_BYTES ||
      typeof requestId !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId) ||
      !["preview", "commit"].includes(String(mode))
    )
      throw new CatalogInputError("5 MB хүртэл .xlsx файл сонгоно уу.");
    const parsed = await parseMerchantWorkbook(
      new Uint8Array(await file.arrayBuffer()),
      requestId,
    );
    if (mode === "preview")
      return NextResponse.json(
        {
          valid: parsed.valid,
          rows: parsed.rows.map((row) => ({
            row: row.row,
            name: row.name,
            category: row.category,
            price: row.price,
            errors: row.errors,
          })),
          hash: parsed.hash,
        },
        { headers: { ...merchantHeaders, "X-Merchant-Mutation": "none" } },
      );
    if (!parsed.valid)
      throw new CatalogInputError(
        "Файлын алдаатай мөрүүдийг зассаны дараа импортлоно уу.",
      );
    if (form.get("hash") !== parsed.hash)
      throw new CatalogInputError("Файл өөрчлөгдсөн байна. Дахин шалгана уу.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "import_merchant_products",
      {
        p_actor: auth.userId,
        p_request: requestId,
        p_hash: parsed.hash,
        p_products: toJson(parsed.rows.map((row) => row.product)),
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { status: 201, headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Барааны импорт амжилтгүй боллоо.");
  }
}
