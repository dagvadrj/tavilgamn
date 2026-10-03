import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { isRecord, OrderInputError, parseSelections } from "@/lib/orderValidation";
import { quoteOrder } from "@/lib/orderService";
import { enforceApiRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const rateLimitResponse = await enforceApiRateLimit(request, auth.userId);
    if (rateLimitResponse) return rateLimitResponse;
    const body: unknown = await request.json();
    const items = parseSelections(isRecord(body) ? body.items : null);
    return NextResponse.json(await quoteOrder(items), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OrderInputError) return apiErrorResponse({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return apiErrorResponse({ error: "Хүсэлтийн бүтэц буруу байна." }, { status: 400 });
    console.error("[orders/quote] failed");
    return apiErrorResponse({ error: "Үнийг шалгаж чадсангүй. Дахин оролдоно уу." }, { status: 503 });
  }
}
