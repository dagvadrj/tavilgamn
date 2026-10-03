import { NextRequest } from "next/server";
import { enforceApiRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

function finite(value: unknown, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= maximum
  );
}

async function readMetric(request: NextRequest) {
  if (!request.body) throw new Error("Empty metric");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        throw new Error("Metric too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  const origin = request.headers.get("origin");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (
    (origin && origin !== request.nextUrl.origin) ||
    (Number.isFinite(length) && length > 4096)
  ) {
    return Response.json({ error: "Invalid metric" }, { status: 400, headers });
  }

  try {
    const metric = await readMetric(request);
    const validAsset =
      typeof metric?.asset === "string" &&
      metric.asset.length <= 160 &&
      /^[a-zA-Z0-9._/-]+$/.test(metric.asset);
    const validVariant = ["preview", "high"].includes(metric?.variant);
    const validTiming = [
      metric?.readyMs,
      metric?.queueMs,
      metric?.loadDecodeMs,
    ].every((value) => finite(value, 600_000));
    const validResource =
      metric?.resourceDurationMs === null ||
      finite(metric?.resourceDurationMs, 600_000);
    const validBytes =
      metric?.encodedBodySize === null ||
      finite(metric?.encodedBodySize, 250 * 1024 * 1024);
    const validTotal = metric?.totalReadyMs === undefined || finite(metric.totalReadyMs, 600_000);
    const validCache = metric?.cacheHit === undefined || typeof metric.cacheHit === "boolean";

    if (!validAsset || !validVariant || !validTiming || !validResource || !validBytes || !validTotal || !validCache) {
      return Response.json({ error: "Invalid metric" }, { status: 400, headers });
    }

    console.info("[model-performance]", JSON.stringify({
      asset: metric.asset,
      variant: metric.variant,
      readyMs: metric.readyMs,
      queueMs: metric.queueMs,
      loadDecodeMs: metric.loadDecodeMs,
      resourceDurationMs: metric.resourceDurationMs,
      encodedBodySize: metric.encodedBodySize,
      totalReadyMs: metric.totalReadyMs,
      cacheHit: metric.cacheHit,
    }));
    return new Response(null, { status: 204, headers });
  } catch {
    return Response.json({ error: "Invalid metric" }, { status: 400, headers });
  }
}
