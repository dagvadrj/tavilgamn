import { NextResponse } from "next/server";
import { KitchenMarketplaceInputError } from "./kitchenMarketplace";

export const kitchenPrivateHeaders = { "Cache-Control": "private, no-store" };

export function kitchenMarketplaceError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
  const message = error instanceof KitchenMarketplaceInputError
    ? error.message
    : code === "42501"
      ? "Энэ үйлдлийг зөвхөн идэвхтэй үйлдвэр эсвэл гар хийцийн дэлгүүр хийж болно."
      : code === "P0002"
        ? "Загвар олдсонгүй. Жагсаалтаа шинэчилнэ үү."
        : code === "P0010"
          ? "Хяналтад илгээхийн өмнө үндсэн thumbnail зураг оруулна уу."
          : code === "P0011"
            ? "Энэ загварт идэвхтэй AI render хүсэлт аль хэдийн байна."
          : fallback;
  const status = error instanceof KitchenMarketplaceInputError
    ? 400
    : code === "42501"
      ? 403
      : code === "P0002"
        ? 404
        : code === "P0010"
          ? 409
          : code === "P0011"
            ? 409
          : 503;
  return NextResponse.json({ error: message }, { status, headers: kitchenPrivateHeaders });
}
