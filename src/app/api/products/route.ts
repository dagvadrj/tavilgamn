import { apiErrorResponse } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { readProducts } from "@/lib/catalogServer";
import { createCatalogCache } from "@/lib/catalogCache";

export const dynamic = "force-dynamic";
const catalog = createCatalogCache(() => readProducts());

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const startedAt = performance.now();

  try {
    const fresh = request?.url ? new URL(request.url).searchParams.get("fresh") === "1" : false;
    const result = await catalog.get(fresh);
    return NextResponse.json(
      { products: result.value },
      { headers: { ...headers, "Server-Timing": `catalog;dur=${(performance.now() - startedAt).toFixed(1)};desc="${result.cache}"` } },
    );
  } catch {
    return apiErrorResponse(
      { error: "Тавилгын мэдээллийг ачаалж чадсангүй." },
      { status: 503, headers },
    );
  }
}
