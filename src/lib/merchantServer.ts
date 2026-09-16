import "server-only";
import type { Store } from "./types";
import { NextResponse } from "next/server";
import { CatalogInputError } from "./catalogValidation";
import { parseMerchantStore } from "./merchantValidation";

export const merchantHeaders = { "Cache-Control": "private, no-store" };

export function merchantStoreFromRow(row: Record<string, unknown>): Store {
  return {
    ...parseMerchantStore({ ...row, storeType: row.store_type }),
    id: String(row.id), productIds: [],
  };
}

export function merchantError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error instanceof CatalogInputError ? error.message
    : code === "42501" ? "Дэлгүүрийн эрх өөрчлөгдсөн байна. Эрхээ шалгана уу."
    : code === "P0002" ? "Мэдээлэл олдсонгүй. Жагсаалтаа шинэчилнэ үү."
    : code === "P0003" ? "Нөөц өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин засна уу."
    : code === "P0009" ? "Захиалгын төлөв өөрчлөгдсөн эсвэл төлбөр хүлээж байна. Жагсаалтаа шинэчилнэ үү."
    : fallback;
  const status = error instanceof CatalogInputError ? 400 : code === "42501" ? 403 : code === "P0002" ? 404 : code === "P0003" || code === "P0009" ? 409 : 503;
  return NextResponse.json({ error: message }, { status, headers: merchantHeaders });
}
