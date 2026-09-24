import { NextResponse } from "next/server";
import { CatalogInputError } from "./catalogValidation";
import { KitchenMarketplaceInputError } from "./kitchenMarketplace";

export const kitchenPrivateHeaders = { "Cache-Control": "private, no-store" };

export function kitchenMarketplaceError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const inputError = error instanceof KitchenMarketplaceInputError || error instanceof CatalogInputError;
  const message = inputError
    ? error.message
    : code === "42501"
      ? "Энэ үйлдлийг зөвхөн идэвхтэй үйлдвэр эсвэл гар хийцийн дэлгүүр хийж болно."
      : code === "P0002"
        ? "Загвар олдсонгүй. Жагсаалтаа шинэчилнэ үү."
        : code === "P0010"
          ? "Хяналтад илгээхийн өмнө үндсэн thumbnail зураг оруулна уу."
          : code === "P0011"
            ? "Энэ загварт идэвхтэй AI render хүсэлт аль хэдийн байна."
          : code === "P0012"
            ? "Загварын төлөв өөрчлөгдсөн байна. Жагсаалтаа шинэчлээд дахин оролдоно уу."
          : code === "P0013"
            ? "Төсөл үүсгэх хүсэлт давхцлаа. Дахин оролдоно уу."
          : code === "P0014"
            ? "Нийтлэгдсэн загварын snapshot ашиглах боломжгүй байна."
          : fallback;
  const status = inputError
    ? 400
    : code === "42501"
      ? 403
      : code === "P0002"
        ? 404
        : code === "P0010"
          ? 409
          : code === "P0011"
            ? 409
          : code === "P0012"
            ? 409
          : code === "P0013"
            ? 409
          : code === "P0014"
            ? 409
          : 503;
  return NextResponse.json({ error: message }, { status, headers: kitchenPrivateHeaders });
}
