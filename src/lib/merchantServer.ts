import { apiErrorResponse } from "@/lib/api/errors";
import "server-only";
import type { Store } from "./types";

import { CatalogInputError } from "./catalogValidation";
import { parseMerchantStore } from "./merchantValidation";
import { jsonObject } from "./supabase/json";

export const merchantHeaders = { "Cache-Control": "private, no-store" };

export function merchantStoreFromRow(value: unknown): Store {
  const row = jsonObject(value);
  return {
    ...parseMerchantStore({ ...row, storeType: row.store_type }),
    id: String(row.id),
    ...(typeof row.is_featured === "boolean"
      ? { isFeatured: row.is_featured }
      : {}),
    ...(row.featured_rank === null ||
    (typeof row.featured_rank === "number" &&
      Number.isInteger(row.featured_rank) &&
      row.featured_rank > 0)
      ? { featuredRank: row.featured_rank as number | null }
      : {}),
  };
}

export function merchantError(error: unknown, fallback: string) {
  const code =
    error && typeof error === "object" && "code" in error ? error.code : null;
  const message =
    error instanceof CatalogInputError
      ? error.message
      : code === "42501"
        ? "Дэлгүүрийн эрх өөрчлөгдсөн байна. Эрхээ шалгана уу."
        : code === "P0002"
          ? "Мэдээлэл олдсонгүй. Жагсаалтаа шинэчилнэ үү."
          : code === "P0003"
            ? "Нөөц өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин засна уу."
            : code === "P0009"
              ? "Захиалгын төлөв өөрчлөгдсөн эсвэл төлбөр хүлээж байна. Жагсаалтаа шинэчилнэ үү."
              : code === "P0015"
                ? "Үнийн хүсэлтийн төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчилнэ үү."
                : fallback;
  const status =
    error instanceof CatalogInputError
      ? 400
      : code === "42501"
        ? 403
        : code === "P0002"
          ? 404
          : code === "P0003" || code === "P0009" || code === "P0015"
            ? 409
            : 503;
  return apiErrorResponse(
    { error: message },
    { status, headers: merchantHeaders },
  );
}
