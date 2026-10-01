import { NextResponse } from "next/server";

export const privateHeaders = { "Cache-Control": "private, no-store" };
const codes: Record<number, string> = {
  400: "BAD_REQUEST", 401: "AUTH_REQUIRED", 403: "FORBIDDEN", 404: "NOT_FOUND",
  409: "CONFLICT", 413: "PAYLOAD_TOO_LARGE", 415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR", 429: "RATE_LIMITED", 500: "INTERNAL_ERROR",
  502: "BAD_GATEWAY", 503: "SERVICE_UNAVAILABLE", 504: "TIMEOUT",
};

/** Keeps the existing error string for UI compatibility; code is machine-readable. */
export function apiErrorResponse(
  body: { error: string; code?: string; [key: string]: unknown },
  init: ResponseInit = {},
) {
  const status = init.status ?? 500;
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(
    { ...body, code: body.code ?? codes[status] ?? "REQUEST_FAILED" },
    { ...init, status, headers },
  );
}
