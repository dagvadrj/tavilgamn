import "server-only";
import { NextResponse } from "next/server";
import { CatalogInputError } from "./catalogValidation";
import { merchantHeaders } from "./merchantServer";

export function growthError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const message =
    error instanceof CatalogInputError
      ? error.message
      : code === "P0021"
        ? "Гэрчилгээ, дансны баталгаажуулалт эсвэл кредитийн тохиргоогоо шалгана уу."
        : code === "P0022"
          ? "Хэтэвчийн боломжит үлдэгдэл хүрэлцэхгүй байна."
          : code === "23505"
            ? "Энэ холбоос эсвэл гүйлгээний дугаар бүртгэгдсэн байна."
            : code === "P0003"
              ? "Мэдээлэл өөрчлөгдсөн байна. Шинэчлээд дахин оролдоно уу."
              : code === "42501"
                ? "Энэ үйлдлийг хийх эрхгүй байна."
                : "Мэдээллийг боловсруулж чадсангүй. Дахин оролдоно уу.";
  return NextResponse.json(
    { error: message },
    {
      status:
        error instanceof CatalogInputError || code === "22023"
          ? 400
          : code === "42501"
            ? 403
            : ["P0021", "P0022", "23505", "P0003"].includes(code)
              ? 409
              : 503,
      headers: merchantHeaders,
    },
  );
}
export function storeShareOrigin(requestUrl: string) {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
        return url.origin;
    } catch {
      // Fall back to the canonical origin when deployment configuration is invalid.
    }
  }
  const url = new URL(requestUrl);
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? url.origin
    : "https://tavilga.mn";
}
