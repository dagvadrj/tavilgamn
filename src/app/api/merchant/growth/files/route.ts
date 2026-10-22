import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonObject, toJson } from "@/lib/supabase/json";
import { merchantHeaders } from "@/lib/merchantServer";
import { CatalogInputError } from "@/lib/catalogValidation";
import { growthText } from "@/lib/merchantGrowth";
import { growthError } from "@/lib/merchantGrowthServer";
import { validateGrowthFile, readGrowthForm } from "@/lib/merchantGrowthFiles";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMerchant(request);
    if (auth.error) return auth.error;
    if (Number(request.headers.get("content-length")) > 51 * 1024 * 1024)
      throw new CatalogInputError("Файлын хэмжээ хэтэрсэн байна.");
    const db = getSupabaseAdmin();
    const snapshot = await db.rpc("read_merchant_growth", {
      p_actor: auth.userId,
    });
    if (snapshot.error) throw snapshot.error;
    const sid = growthText(jsonObject(snapshot.data).storeId, 1, 200);
    const form = await readGrowthForm(request);
    const kind = form.get("kind");
    if (kind !== "certificate" && kind !== "model")
      throw new CatalogInputError("Файлын төрөл буруу байна.");
    const file = form.get("file");
    if (!(file instanceof File))
      throw new CatalogInputError("Файлаа сонгоно уу.");
    const details =
      kind === "certificate"
        ? {
            legalName: growthText(form.get("legalName"), 2, 200),
            registrationNo: growthText(form.get("registrationNo"), 4, 40),
          }
        : { productId: growthText(form.get("productId"), 1, 200) };
    if (kind === "model") {
      const { data, error } = await db
        .from("furniture_models")
        .select("store_ids")
        .eq("product_id", growthText(details.productId, 1, 200))
        .is("archived_at", null)
        .maybeSingle();
      if (error) throw error;
      if (
        !data ||
        !Array.isArray(data.store_ids) ||
        data.store_ids.length !== 1 ||
        data.store_ids[0] !== sid
      )
        throw new CatalogInputError("Өөрийн дэлгүүрийн барааг сонгоно уу.");
    }
    if (
      !file.size ||
      file.size > (kind === "certificate" ? 10 : 50) * 1024 * 1024
    )
      throw new CatalogInputError("Файлын хэмжээ хэтэрсэн байна.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateGrowthFile(bytes, file.name, kind);
    const path = `${auth.userId}/${sid}/${kind}/${randomUUID()}.${validated.extension}`;
    const uploaded = await db.storage
      .from("merchant-private")
      .upload(path, bytes, {
        contentType: validated.contentType,
        upsert: false,
      });
    if (uploaded.error) throw uploaded.error;
    const result = await db.rpc("save_merchant_growth", {
      p_actor: auth.userId,
      p_action: kind,
      p_data: toJson({ ...details, path, name: file.name }),
    });
    if (result.error) {
      if (["22023", "23505", "42501", "P0023"].includes(result.error.code))
        await db.storage.from("merchant-private").remove([path]);
      throw result.error;
    }
    return NextResponse.json(result.data, { headers: merchantHeaders });
  } catch (error) {
    return growthError(error);
  }
}
