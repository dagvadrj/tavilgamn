import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readHomepageSettings } from "@/lib/homepageSettingsServer";
import { parseHomepageSettings } from "@/lib/homepageSettings";
import { readProduct } from "@/lib/catalogServer";
import { readCachedProducts } from "@/lib/publicCatalog";
import { apiErrorResponse, privateHeaders } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const fail = (error: string, status: number) =>
  apiErrorResponse({ error }, { status, headers: privateHeaders });

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const [settings, catalog] = await Promise.all([
      readHomepageSettings(),
      readCachedProducts(),
    ]);
    return NextResponse.json(
      {
        ...settings,
        products: catalog
          .filter((product) => product.category === "sofa" && product.model)
          .map(({ id, name, image }) => ({ id, name, image })),
      },
      { headers: privateHeaders },
    );
  } catch {
    return fail("Нүүр хуудасны тохиргоог ачаалж чадсангүй.", 503);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    if (Number(request.headers.get("content-length") || 0) > 2048)
      return fail("Хүсэлт хэт том байна.", 413);
    const raw = await request.text();
    if (raw.length > 2048) return fail("Хүсэлт хэт том байна.", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("Хүсэлт буруу байна.", 400);
    }
    const settings = parseHomepageSettings(body);
    if (!settings) return fail("Хоёр өөр 3D буйдан сонгоно уу.", 400);
    const products = await Promise.all(
      settings.productIds.map((id) => readProduct(id)),
    );
    if (
      products.some((product) => !product?.model || product.category !== "sofa")
    )
      return fail(
        "Сонгосон буйдан нийтэд харагдах 3D загвартай байх ёстой.",
        422,
      );
    const row = {
      id: 1,
      product_ids: settings.productIds,
      version: settings.version + 1,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
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
      { productIds: settings.productIds, version: result.data!.version },
      { headers: privateHeaders },
    );
  } catch {
    return fail("Тохиргоог хадгалж чадсангүй. Дахин оролдоно уу.", 503);
  }
}
