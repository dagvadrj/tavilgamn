import "server-only";
import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabase/admin";
import { apiErrorResponse } from "./api/errors";

type Policy = { scope: string; limit: number; windowSeconds: number };
const localBuckets = new Map<string, { count: number; end: number }>();

export function apiRatePolicy(path: string, method: string): Policy | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
  if (path === "/api/contact") return { scope: "contact", limit: 5, windowSeconds: 900 };
  if (path === "/api/model-metrics" || path === "/api/telemetry") return { scope: "telemetry", limit: 120, windowSeconds: 60 };
  if (/^\/api\/room-projects(?:\/[^/]+)?$/.test(path)) return { scope: "room-project", limit: 60, windowSeconds: 60 };
  if (/^\/api\/(?:admin\/kitchen-render-jobs\/[^/]+\/generate|merchant\/kitchen-designs\/[^/]+\/renders)$/.test(path)) {
    return { scope: "render", limit: 6, windowSeconds: 60 };
  }
  if (/^\/api\/(?:kitchen-designs\/[^/]+\/quotes|orders\/quote)$/.test(path)) {
    return { scope: "quote", limit: 30, windowSeconds: 60 };
  }
  if (/^\/api\/(?:models\/upload|admin\/models\/upload-(?:url|complete)|(?:admin|merchant)\/images|merchant\/kitchen-designs\/[^/]+\/media|kitchens\/[^/]+\/thumbnail|admin\/kitchen-material-textures)$/.test(path)) {
    return { scope: "upload", limit: 20, windowSeconds: 60 };
  }
  return null;
}

function identity(request: NextRequest, actor?: string) {
  if (actor) return `user:${actor}`;
  // Vercel overwrites this header at its trusted edge. On another host, a shared
  // anonymous bucket is safer than trusting a caller-controlled forwarded IP.
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for") : null;
  const address = forwarded?.split(",")[0]?.trim();
  return `ip:${address && /^[a-fA-F0-9:.]{1,64}$/.test(address) ? address : "unknown"}`;
}

export async function enforceApiRateLimit(request: NextRequest, actor?: string) {
  const path = request.nextUrl?.pathname ?? (request.url ? new URL(request.url).pathname : "");
  const policy = apiRatePolicy(path, request.method ?? "GET");
  if (!policy) return null;
  const deployed = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (deployed && !secret) return apiErrorResponse({ error: "Үйлчилгээ түр боломжгүй байна." }, { status: 503 });
  const key = createHmac("sha256", secret || "local-development").update(identity(request, actor)).digest("hex");
  let allowed: boolean;
  let retryAfter: number;
  try {
    if (deployed) {
      const { data, error } = await getSupabaseAdmin().rpc("consume_api_rate_limit", {
        p_scope: policy.scope, p_identity: key, p_limit: policy.limit, p_window_seconds: policy.windowSeconds,
      });
      if (error || !data || typeof data.allowed !== "boolean" || !Number.isFinite(data.retryAfter)) throw new Error("RATE_LIMIT_UNAVAILABLE");
      allowed = data.allowed;
      retryAfter = data.retryAfter;
    } else {
      const now = Date.now();
      for (const [id, bucket] of localBuckets) if (bucket.end <= now) localBuckets.delete(id);
      const bucketKey = `${policy.scope}:${key}`;
      if (!localBuckets.has(bucketKey) && localBuckets.size >= 5000) throw new Error("RATE_LIMIT_UNAVAILABLE");
      const bucket = localBuckets.get(bucketKey) ?? { count: 0, end: now + policy.windowSeconds * 1000 };
      bucket.count++;
      localBuckets.set(bucketKey, bucket);
      allowed = bucket.count <= policy.limit;
      retryAfter = Math.ceil((bucket.end - now) / 1000);
    }
  } catch {
    return apiErrorResponse({ error: "Үйлчилгээ түр боломжгүй байна. Дахин оролдоно уу." }, { status: 503 });
  }
  return allowed ? null : apiErrorResponse({ error: "Олон хүсэлт илгээсэн байна. Түр хүлээгээд дахин оролдоно уу." }, {
    status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfter))) },
  });
}
