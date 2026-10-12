import { apiErrorResponse } from "@/lib/api/errors";

import { CatalogInputError } from "./catalogValidation";
import { KitchenMarketplaceInputError } from "./kitchenMarketplace";

export const kitchenPrivateHeaders = { "Cache-Control": "private, no-store" };

export function kitchenMarketplaceError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "CLOUDFLARE_RENDER_QUOTA") {
    return apiErrorResponse(
      {
        error:
          "Cloudflare-ийн render квот дууссан байна. Дараа дахин оролдоно уу.",
      },
      { status: 429, headers: kitchenPrivateHeaders },
    );
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const inputError =
    error instanceof KitchenMarketplaceInputError ||
    error instanceof CatalogInputError;
  const phase4Errors: Record<string, { message: string; status: number }> = {
    P0020: {
      message:
        "Идэвхтэй AI render-ийн эх зургийг устгах боломжгүй. Хүсэлтийг дуусгах эсвэл цуцална уу.",
      status: 409,
    },
    P0016: {
      message:
        "Хяналтад илгээхийн өмнө AI render-ийг дуусгах эсвэл цуцална уу.",
      status: 409,
    },
    P0017: {
      message:
        "Merchant-ийн AI render зөвшөөрөл шаардлагатай. Хуучин хүсэлтийг цуцлаад шинээр илгээнэ үү.",
      status: 409,
    },
    P0018: { message: "Шийдвэрийн шалтгааныг бичнэ үү.", status: 400 },
    P0019: {
      message: "Энэ загварын 3 AI render-ийн хязгаарт хүрсэн байна.",
      status: 429,
    },
    P0022: { message: "AI render үйлчилгээ түр зогссон байна.", status: 503 },
  };
  if (phase4Errors[code])
    return apiErrorResponse(
      { error: phase4Errors[code].message },
      { status: phase4Errors[code].status, headers: kitchenPrivateHeaders },
    );
  const message = inputError
    ? error.message
    : code === "42501"
      ? "Энэ үйлдлийг хийх эрх хүрэлцэхгүй байна."
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
  return apiErrorResponse(
    { error: message },
    { status, headers: kitchenPrivateHeaders },
  );
}
