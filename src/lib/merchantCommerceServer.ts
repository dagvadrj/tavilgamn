import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { CatalogInputError } from "./catalogValidation";
import { merchantError, merchantHeaders } from "./merchantServer";
import { apiErrorResponse } from "./api/errors";

export function commerceError(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P0025"
  )
    return apiErrorResponse(
      {
        error:
          "5,000-аас олон мөртэй байна. Хугацаа эсвэл барааны шүүлтүүрээ нарийсгана уу.",
      },
      { status: 400, headers: merchantHeaders },
    );
  return merchantError(error, fallback);
}
export function documentResponse(
  bytes: Uint8Array | ArrayBuffer,
  name: string,
  format: "pdf" | "xlsx",
) {
  return new NextResponse(
    new Uint8Array(
      bytes instanceof ArrayBuffer ? bytes : (bytes as Uint8Array),
    ),
    {
      headers: {
        ...merchantHeaders,
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.${format}"`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
export async function limitedBody(request: NextRequest, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new CatalogInputError("Файлын хэмжээ хэт том байна.");
  const reader = request.body?.getReader();
  if (!reader) throw new CatalogInputError("Хүсэлтийн мэдээлэл алга.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > limit) {
      await reader.cancel();
      throw new CatalogInputError("Файлын хэмжээ хэт том байна.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function commerceJson(request: NextRequest) {
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        await limitedBody(request, 450000),
      ),
    );
  } catch (error) {
    if (error instanceof CatalogInputError) throw error;
    throw new CatalogInputError("JSON мэдээлэл буруу байна.");
  }
}
