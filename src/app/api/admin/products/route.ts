import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  CatalogInputError,
  parseProduct,
} from "@/lib/catalogValidation";
import { STORES } from "@/lib/stores";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

async function save(request: NextRequest, create: boolean) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set(
        "Cache-Control",
        headers["Cache-Control"],
      );
      return auth.error;
    }

    let raw;

    try {
      raw = await request.json();
    } catch {
      throw new CatalogInputError("JSON буруу байна.");
    }

    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new CatalogInputError("Барааны мэдээлэл буруу байна.");
    }

    if (!Number.isSafeInteger(raw.stockQuantity) || raw.stockQuantity < 0 || raw.stockQuantity > 1_000_000) throw new CatalogInputError("Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна.");
    if (!create && raw.expectedStockQuantity !== null && (!Number.isSafeInteger(raw.expectedStockQuantity) || raw.expectedStockQuantity < 0)) throw new CatalogInputError("Нөөцийн мэдээллээ шинэчилнэ үү.");
    const product = parseProduct({
      ...raw,
      ...(create
        ? {
            id: randomUUID(),
            rating: 0,
            reviewCount: 0,
          }
        : {}),
    });

    if (
      product.storeIds?.some(
        (id) => !STORES.some((store) => store.id === id),
      )
    ) {
      throw new CatalogInputError(
        "Дэлгүүрийн сонголт буруу байна.",
      );
    }

    const { error } = await getSupabaseAdmin().rpc(
      "save_furniture_product",
      {
        p_data: product,
        p_create: create,
        p_expected_stock: create ? null : raw.expectedStockQuantity,
      },
    );

    if (error?.code === "P0003") return NextResponse.json({ error: "Нөөц өөрчлөгдсөн байна. Жагсаалт руу буцаж шинэчлээд дахин засна уу." }, { status: 409, headers });
    if (error?.code === "P0002") {
      return NextResponse.json(
        {
          error: "Бараа олдсонгүй. Жагсаалтаа шинэчилнэ үү.",
        },
        { status: 404, headers },
      );
    }

    if (error) throw error;

    return NextResponse.json(
      { id: product.id },
      { status: create ? 201 : 200, headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CatalogInputError
            ? error.message
            : "Барааг хадгалж чадсангүй.",
      },
      {
        status: error instanceof CatalogInputError ? 400 : 503,
        headers,
      },
    );
  }
}

export const POST = (request: NextRequest) =>
  save(request, true);

export const PUT = (request: NextRequest) =>
  save(request, false);