import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { operationUuid } from "@/lib/merchantOperations";
import { parseQuotationLines, quotationTotal } from "@/lib/kitchenQuotation";
import { CatalogInputError } from "@/lib/catalogValidation";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
async function run(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  write: boolean,
) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    const id = operationUuid((await context.params).id),
      raw = write ? await request.json().catch(() => null) : { action: "read" };
    if (
      !raw ||
      !["read", "publish", "schedule", "respond"].includes(raw.action)
    )
      throw new CatalogInputError("Хүсэлт буруу байна.");
    let input = raw;
    if (raw.action === "publish") {
      const items = parseQuotationLines(raw.items);
      quotationTotal(items);
      if (
        !["submitted", "reviewing"].includes(raw.expectedStatus) ||
        typeof raw.note !== "string" ||
        raw.note.length > 5000
      )
        throw new CatalogInputError("Саналын төлөв, тайлбар буруу байна.");
      input = { items, note: raw.note, expectedStatus: raw.expectedStatus };
    } else if (raw.action === "schedule") {
      if (
        typeof raw.engineer !== "string" ||
        raw.engineer.trim().length < 2 ||
        raw.engineer.length > 100 ||
        !Number.isFinite(Date.parse(raw.startsAt)) ||
        !Number.isFinite(Date.parse(raw.endsAt))
      )
        throw new CatalogInputError(
          "Инженер болон хэмжилтийн цагаа оруулна уу.",
        );
      input = {
        engineer: raw.engineer.trim(),
        startsAt: new Date(raw.startsAt).toISOString(),
        endsAt: new Date(raw.endsAt).toISOString(),
        version: raw.version ?? null,
      };
    } else if (
      raw.action === "respond" &&
      (!["confirmed", "declined"].includes(raw.status) ||
        !Number.isInteger(raw.version))
    )
      throw new CatalogInputError("Цагийн хариу буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc("kitchen_commerce", {
      p_actor: auth.userId,
      p_quote: id,
      p_action: raw.action,
      p_data: toJson(input),
    });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (e) {
    return merchantError(
      e,
      "Үнийн санал, хэмжилтийн цагийг хадгалж чадсангүй.",
    );
  }
}
export const GET = (r: NextRequest, c: { params: Promise<{ id: string }> }) =>
  run(r, c, false);
export const POST = (r: NextRequest, c: { params: Promise<{ id: string }> }) =>
  run(r, c, true);
