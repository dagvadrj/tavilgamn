import { apiErrorResponse } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseContact } from "@/lib/contact";
import { enforceApiRateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceApiRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;
  const headers = { "Cache-Control": "no-store" };
  let contact;
  try {
    const text = await request.text();
    if (text.length > 16000) return apiErrorResponse({ error: "Зурвас хэт урт байна." }, { status: 413, headers });
    contact = parseContact(JSON.parse(text));
  } catch (error) {
    return apiErrorResponse({ error: error instanceof SyntaxError ? "Зурвасын бүтэц буруу байна." : error instanceof Error ? error.message : "Мэдээллээ шалгана уу." }, { status: 400, headers });
  }
  try {
    const { error } = await getSupabaseAdmin().rpc("submit_contact_message", {
      p_name: contact.name, p_email: contact.email, p_message: contact.message,
    });
    if (error?.code === "P0006") return apiErrorResponse({ error: "Олон зурвас илгээсэн байна. 15 минутын дараа дахин оролдоно уу." }, { status: 429, headers });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 201, headers });
  } catch {
    return apiErrorResponse({ error: "Зурвас хадгалагдсангүй. Түр хүлээгээд дахин оролдоно уу." }, { status: 503, headers });
  }
}
