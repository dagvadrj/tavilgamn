import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { CatalogInputError } from "@/lib/catalogValidation";
import { FurnitureRow, productFromRow } from "@/lib/catalogServer";
type MerchantFurnitureRow = FurnitureRow & {
  model_requested?: boolean | null;
};
import { merchantObject, parseMerchantProduct } from "@/lib/merchantValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const products = [];
    const db = getSupabaseAdmin();
    let after: string | null = null;
    for (;;) {
      const { data, error } = await db.rpc("read_merchant_products", { p_actor: auth.userId, p_after: after });
      if (error) throw error;
      const rows = (data ?? []) as MerchantFurnitureRow[];

products.push(
  ...rows.map((row) => ({
    ...productFromRow(row),
    modelRequested: Boolean(row.model_requested),
  })),
);
      if (rows.length < 500) break;
      after = rows[rows.length - 1].id;
    }
    return NextResponse.json({ products }, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Барааны мэдээллийг ачаалж чадсангүй."); }
}

async function save(request: NextRequest, create: boolean) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    const raw = merchantObject(await request.json().catch(() => { throw new CatalogInputError("JSON буруу байна."); }));
    if (!create && (typeof raw.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.id))) throw new CatalogInputError("Барааны ID буруу байна.");
    if (!create && raw.expectedStockQuantity !== null && (!Number.isSafeInteger(raw.expectedStockQuantity) || Number(raw.expectedStockQuantity) < 0 || Number(raw.expectedStockQuantity) > 1_000_000)) throw new CatalogInputError("Нөөцийн мэдээллээ шинэчилнэ үү.");

    const modelRequested =
  raw.modelRequested === undefined
    ? false
    : raw.modelRequested;

if (typeof modelRequested !== "boolean") {
  throw new CatalogInputError(
    "3D загварын хүсэлтийн мэдээлэл буруу байна.",
  );
}

    const product = parseMerchantProduct(raw, create ? randomUUID() : raw.id as string);
    const { error } = await getSupabaseAdmin().rpc(
  "save_merchant_product_v2",
  {
    p_actor: auth.userId,
    p_data: product,
    p_create: create,
    p_model_requested: modelRequested,
    p_expected_stock:
      create ? null : raw.expectedStockQuantity,
  },
);
    if (error) throw error;
    return NextResponse.json({ id: product.id }, { status: create ? 201 : 200, headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Барааг хадгалж чадсангүй."); }
}

export const POST = (request: NextRequest) => save(request, true);
export const PUT = (request: NextRequest) => save(request, false);
