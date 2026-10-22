import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CatalogInputError } from "@/lib/catalogValidation";
import { commerceJson, commerceError } from "@/lib/merchantCommerceServer";
import { merchantHeaders } from "@/lib/merchantServer";
import { merchantObject } from "@/lib/merchantValidation";
import { toJson } from "@/lib/supabase/json";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const page = Number(request.nextUrl.searchParams.get("page") ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
      throw new CatalogInputError("Хуудасны дугаар буруу байна.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_merchant_contracts",
      { p_actor: auth.userId, p_data: toJson({ page }) },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээний мэдээллийг ачаалж чадсангүй.");
  }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const raw = merchantObject(await commerceJson(request));
    if (!["save", "publish"].includes(String(raw.action)))
      throw new CatalogInputError("Үйлдэл буруу байна.");
    if (
      raw.action === "save" &&
      (typeof raw.title !== "string" ||
        !raw.title.trim() ||
        raw.title.length > 200 ||
        typeof raw.platformName !== "string" ||
        !raw.platformName.trim() ||
        raw.platformName.length > 300 ||
        typeof raw.body !== "string" ||
        !raw.body.trim() ||
        raw.body.length > 100000)
    )
      throw new CatalogInputError(
        "Гэрээний гарчиг, платформын хуулийн этгээдийн нэр, эхийг бүрэн оруулна уу.",
      );
    if (
      raw.id != null &&
      (typeof raw.id !== "string" || !/^[a-f0-9-]{36}$/i.test(raw.id))
    )
      throw new CatalogInputError("Гэрээний дугаар буруу байна.");
    if (
      raw.id != null &&
      (!Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0)
    )
      throw new CatalogInputError("Гэрээг дахин ачаална уу.");
    const { data, error } = await getSupabaseAdmin().rpc(
      "admin_merchant_contracts",
      {
        p_actor: auth.userId,
        p_action: String(raw.action),
        p_data: toJson(raw),
      },
    );
    if (error) throw error;
    return NextResponse.json(data, { headers: merchantHeaders });
  } catch (error) {
    return commerceError(error, "Гэрээг хадгалж чадсангүй.");
  }
}
