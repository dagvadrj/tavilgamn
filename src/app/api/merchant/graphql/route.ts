import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { executeMerchantQuery } from "@/lib/merchantGraphql";
import { merchantHeaders } from "@/lib/merchantServer";
import { createMerchantReadServices } from "@/lib/merchantGraphqlReads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  ...merchantHeaders,
  "Content-Type": "application/graphql-response+json; charset=utf-8",
};
const failure = (status: number, message: string) =>
  NextResponse.json({ errors: [{ message }] }, { status, headers });

export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request).catch(() => ({
    error: failure(503, "Нэвтрэлтийг шалгаж чадсангүй."),
    userId: undefined,
  }));
  if (auth.error) return auth.error;
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return failure(415, "JSON хүсэлт илгээнэ үү.");
  // Read a bounded stream, including chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return failure(400, "Query шаардлагатай.");
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  let body;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return failure(413, "Хүсэлт хэт том байна.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    body = JSON.parse(text);
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.query !== "string" ||
      !body.query.trim() ||
      (body.operationName != null && typeof body.operationName !== "string") ||
      (body.variables != null &&
        (typeof body.variables !== "object" || Array.isArray(body.variables)))
    )
      return failure(400, "GraphQL хүсэлт буруу байна.");
  } catch {
    return failure(400, "GraphQL хүсэлтийг уншиж чадсангүй.");
  } finally {
    reader.releaseLock();
  }
  try {
    const db = getSupabaseAdmin();
    const response = await executeMerchantQuery(
      body,
      auth.userId,
      db.rpc.bind(db),
      createMerchantReadServices(db),
    );
    return NextResponse.json(response.result, {
      status: response.status,
      headers,
    });
  } catch {
    return failure(503, "GraphQL мэдээллийг ачаалж чадсангүй.");
  }
}
