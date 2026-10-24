import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readHomepageSettings } from "@/lib/homepageSettingsServer";
import { parseHomepageSettings } from "@/lib/homepageSettings";
import { readProduct } from "@/lib/catalogServer";
import { apiErrorResponse, privateHeaders } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number) =>
  apiErrorResponse({ error }, { status, headers: privateHeaders });

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const settings = await readHomepageSettings();
    return NextResponse.json(settings, { headers: privateHeaders });
  } catch {
    return fail("Нүүр хуудасны тохиргоог ачаалж чадсангүй.", 503);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    if (Number(request.headers.get("content-length") || 0) > 8192)
      return fail("Хүсэлт хэт том байна.", 413);
    const raw = await request.text();
    if (raw.length > 8192) return fail("Хүсэлт хэт том байна.", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Хүсэлт буруу байна.", 400);
    }
    const settings = parseHomepageSettings(body);
    if (!settings)
      return fail("Нүүр хуудасны утга эсвэл холбоос буруу байна.", 400);
    // Hero edits preserve retired scene configuration without requiring old GLBs.
    if (settings.hero) {
      const current = await readHomepageSettings();
      if (current.version !== settings.version)
        return fail("Өөр админ шинэчилсэн байна. Дахин ачаална уу.", 409);
      if ((body as Record<string, unknown>).updateFeatured === true) {
        // Only changed selections need validating; retired fallback assets must not block text edits.
        const changed = settings.productIds.filter(
          (id, index) => id !== current.productIds[index],
        );
        const products = await Promise.all(
          changed.map((id) => readProduct(id)),
        );
        if (
          products.some(
            (product) => !product?.model || product.category !== "sofa",
          )
        )
          return fail(
            "Онцлох бүтээгдэхүүн нийтэд харагдах 3D буйдан байх ёстой.",
            422,
          );
      } else settings.productIds = current.productIds;
      settings.bedProductId = current.bedProductId;
      settings.wardrobeProductId = current.wardrobeProductId;
    } else {
      const products = await Promise.all(
        settings.productIds.map((id) => readProduct(id)),
      );
      if (
        products.some(
          (product) => !product?.model || product.category !== "sofa",
        )
      )
        return fail(
          "Сонгосон буйдан нийтэд харагдах 3D загвартай байх ёстой.",
          422,
        );
      for (const [id, category] of [
        [settings.bedProductId, "bed"],
        [settings.wardrobeProductId, "wardrobe"],
      ] as const) {
        if (!id) continue;
        const product = await readProduct(id);
        if (!product?.model || product.category !== category)
          return fail(
            "Өрөөний сонголт нийтэд харагдах, зөв ангиллын 3D бүтээгдэхүүн байх ёстой.",
            422,
          );
      }
    }
    const row = {
      id: 1,
      product_ids: settings.productIds,
      version: settings.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
      ...(settings.hero ? { hero: { ...settings.hero } } : {}),
      ...(settings.bedProductId !== undefined
        ? { bed_product_id: settings.bedProductId }
        : {}),
      ...(settings.wardrobeProductId !== undefined
        ? { wardrobe_product_id: settings.wardrobeProductId }
        : {}),
    };
    const db = getSupabaseAdmin();
    const result =
      settings.version === 0
        ? await db
            .from("homepage_scene_settings")
            .insert(row)
            .select("version")
            .single()
        : await db
            .from("homepage_scene_settings")
            .update(row)
            .eq("id", 1)
            .eq("version", settings.version)
            .select("version")
            .maybeSingle();
    if (result.error?.code === "23505" || (!result.error && !result.data))
      return fail(
        "Өөр админ тохиргоог шинэчилсэн байна. Дахин ачаалаад оролдоно уу.",
        409,
      );
    if (result.error) throw result.error;
    return NextResponse.json(
      { ...settings, version: result.data!.version },
      { headers: privateHeaders },
    );
  } catch {
    return fail("Тохиргоог хадгалж чадсангүй. Дахин оролдоно уу.", 503);
  }
}
