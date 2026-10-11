import { toJson } from "@/lib/supabase/json";
import { apiErrorResponse } from "@/lib/api/errors";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError, parseProduct } from "@/lib/catalogValidation";
import { readStoreDirectory } from "@/lib/storeDirectory";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

async function save(request: NextRequest, create: boolean) {
  try {
    const auth = await requireAdmin(request);

    if (auth.error) {
      auth.error.headers.set("Cache-Control", headers["Cache-Control"]);
      return auth.error;
    }

    let raw;

    try {
      raw = await request.json();
    } catch {
      throw new CatalogInputError("JSON буруу байна.");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new CatalogInputError("Барааны мэдээлэл буруу байна.");
    }

    if (
      !Number.isSafeInteger(raw.stockQuantity) ||
      raw.stockQuantity < 0 ||
      raw.stockQuantity > 1_000_000
    )
      throw new CatalogInputError(
        "Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна.",
      );
    if (
      !create &&
      raw.expectedStockQuantity !== null &&
      (!Number.isSafeInteger(raw.expectedStockQuantity) ||
        raw.expectedStockQuantity < 0)
    )
      throw new CatalogInputError("Нөөцийн мэдээллээ шинэчилнэ үү.");
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

    const stores = await readStoreDirectory({ includeInactive: true });
    if (
      product.storeIds?.some((id) => !stores.some((store) => store.id === id))
    ) {
      throw new CatalogInputError("Дэлгүүрийн сонголт буруу байна.");
    }

    const db = getSupabaseAdmin();
    if (product.specifications && Object.keys(product.specifications).length) {
      const { error: schemaError } = await db
        .from("furniture_models")
        .select("specifications")
        .limit(0);
      if (schemaError) {
        if (
          ["42703", "PGRST204"].includes(schemaError.code) &&
          schemaError.message.includes("specifications")
        )
          return apiErrorResponse(
            {
              error:
                "Үзүүлэлт хадгалах database migration серверт хэрэгжээгүй байна. Мэдээллээ түр хадгалж, migration хийсний дараа дахин хадгална уу.",
            },
            { status: 503, headers },
          );
        throw schemaError;
      }
    }
    const { error } = await db.rpc("save_furniture_product", {
      p_data: toJson(product),
      p_create: create,
      p_expected_stock: create ? null : raw.expectedStockQuantity,
    });

    if (error?.code === "P0003")
      return apiErrorResponse(
        {
          error:
            "Нөөц өөрчлөгдсөн байна. Жагсаалт руу буцаж шинэчлээд дахин засна уу.",
        },
        { status: 409, headers },
      );
    if (error?.code === "P0002") {
      return apiErrorResponse(
        {
          error: "Бараа олдсонгүй. Жагсаалтаа шинэчилнэ үү.",
        },
        { status: 404, headers },
      );
    }

    if (error?.code === "23514" && error.message.includes("category"))
      return apiErrorResponse(
        {
          error: "Шинэ ангиллын database migration серверт хэрэгжээгүй байна.",
        },
        { status: 503, headers },
      );
    if (error) throw error;

    return NextResponse.json(
      { id: product.id },
      { status: create ? 201 : 200, headers },
    );
  } catch (error) {
    return apiErrorResponse(
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

export const POST = (request: NextRequest) => save(request, true);

export const PUT = (request: NextRequest) => save(request, false);
