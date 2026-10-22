import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/supabase/authorize";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { merchantError, merchantHeaders } from "@/lib/merchantServer";
import { parseOperation, READ_OPERATIONS } from "@/lib/merchantOperations";
import { CatalogInputError } from "@/lib/catalogValidation";
export const dynamic = "force-dynamic";
async function run(request: NextRequest, write: boolean) {
  try {
    const auth = await authorize(request); if (auth.error) return auth.error;
    const params = new URL(request.url).searchParams;
    if (Number(request.headers.get("content-length")) > 100000) throw new CatalogInputError("Мэдээлэл хэт том байна.");
    const raw = write ? await request.json().catch(() => null) : null;
    const action = write ? raw?.action : params.get("action");
    if (typeof action !== "string" || (!write && !READ_OPERATIONS.has(action)) || (write && READ_OPERATIONS.has(action))) throw new CatalogInputError("Үйлдэл буруу байна.");
    const input = write ? raw?.data : Object.fromEntries([...params].map(([key, value]) => [key, key === "page" ? Number(value) : value]));
    const { data, error } = await getSupabaseAdmin().rpc("merchant_operations", { p_actor: auth.userId, p_action: action, p_data: parseOperation(action, input) });
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) { return merchantError(error, "Үйлдлийг хийж чадсангүй. Дахин оролдоно уу."); }
}
export const GET = (r: NextRequest) => run(r, false);
export const POST = (r: NextRequest) => run(r, true);
