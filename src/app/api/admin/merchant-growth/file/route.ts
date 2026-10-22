import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonArray, jsonObject } from "@/lib/supabase/json";
import { merchantHeaders } from "@/lib/merchantServer";
import { CatalogInputError } from "@/lib/catalogValidation";
import { growthError } from "@/lib/merchantGrowthServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const params = new URL(request.url).searchParams;
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("admin_merchant_growth", {
      p_actor: auth.userId,
    });
    if (error) throw error;
    const snapshot = jsonObject(data);
    const model = params.get("kind") === "model";
    const row = jsonArray(
      snapshot[
        model ? "models" : "profiles"
      ] as import("@/lib/supabase/database.types").Json,
    )
      .map(jsonObject)
      .find((item) =>
        model
          ? item.id === params.get("id")
          : item.store_id === params.get("storeId"),
      );
    const path = row?.[model ? "object_path" : "certificate_path"];
    if (typeof path !== "string")
      throw new CatalogInputError("Файл олдсонгүй.");
    const signed = await db.storage
      .from("merchant-private")
      .createSignedUrl(path, 60, { download: true });
    if (signed.error) throw signed.error;
    return NextResponse.json(
      { url: signed.data.signedUrl },
      { headers: merchantHeaders },
    );
  } catch (error) {
    return growthError(error);
  }
}
