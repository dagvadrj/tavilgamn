import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError, parseProduct } from "@/lib/catalogValidation";
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
import { readStoreDirectory } from "@/lib/storeDirectory";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    return documentResponse(
      await merchantImportTemplate(),
      "product-template",
      "xlsx",
    );
  } catch (error) {
    return commerceError(error, "Excel загварыг үүсгэж чадсангүй.");
  }
}

/** Same flow as the merchant import; the admin picks the store the products belong to. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    if (isImportUpload(request))
      return NextResponse.json(await importPreview(request), { headers });
    const body = await readImportJson(request);
    if (body.mode === "errors") return importErrorsResponse(body.rows);
    if (body.mode === "validate")
      return NextResponse.json({ rows: body.rows.map(previewRow) }, { headers: headers });
    const stores = await readStoreDirectory({ includeInactive: true });
    if (!body.storeId || !stores.some((store) => store.id === body.storeId))
      throw new CatalogInputError("Дэлгүүрээ сонгоно уу.");
    const products = validProducts(body.rows).map((product) =>
      parseProduct({ ...product, storeIds: [body.storeId] }),
    );
    const db = getSupabaseAdmin();
    let count = 0,
      replayed = 0;
    for (const product of products) {
      const { error } = await db.rpc("save_furniture_product", {
        p_data: toJson(product),
        p_create: true,
        p_expected_stock: null,
      });
      // IDs derive from the request ID and row, so a retried chunk finds its own rows.
      if (error?.code === "23505") replayed++;
      else if (error) throw error;
      else count++;
    }
    return NextResponse.json(
      { count: count + replayed, replayed: replayed > 0 && !count },
      { status: 201, headers },
    );
  } catch (error) {
    return commerceError(error, "Барааны импорт амжилтгүй боллоо.");
  }
}
