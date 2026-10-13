import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { kitchenPrivateHeaders } from "@/lib/kitchenMarketplaceHttp";
import {
  generateKitchenListingText,
  KITCHEN_TEXT_FIELDS,
  kitchenTextConfigured,
  type KitchenTextField,
} from "@/lib/cloudflareKitchenText";
import { kitchenListingSuggestions } from "@/lib/kitchenListingSuggestions";
import { limitedResponseBytes } from "@/lib/cloudflareKitchenRender";

export const dynamic = "force-dynamic";
export const maxDuration = 65;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: kitchenPrivateHeaders });
export async function POST(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return auth.error;
  try {
    const raw = await limitedResponseBytes(new Response(request.body), 16_000);
    const body = JSON.parse(new TextDecoder().decode(raw));
    if (
      !body ||
      !KITCHEN_TEXT_FIELDS.includes(body.field) ||
      (typeof body.sourceKitchenId === "string"
        ? !UUID.test(body.sourceKitchenId)
        : typeof body.designId !== "string" ||
          !UUID.test(body.designId) ||
          typeof body.versionId !== "string" ||
          !UUID.test(body.versionId))
    )
      return json({ error: "Загвар болон үүсгэх талбараа сонгоно уу." }, 400);
    if (!kitchenTextConfigured())
      return json({ error: "AI тайлбар үүсгэх холболт бэлэн биш байна." }, 503);
    const db = getSupabaseAdmin();
    const { data: store, error: storeError } = await db
      .from("merchant_stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .eq("active", true)
      .in("store_type", ["factory", "handmade"])
      .maybeSingle();
    if (storeError) throw storeError;
    if (!store)
      return json(
        { error: "Идэвхтэй үйлдвэрлэгчийн дэлгүүр шаардлагатай." },
        403,
      );
    let snapshot: unknown;
    let name = "";
    if (typeof body.sourceKitchenId === "string") {
      const { data, error } = await db
        .from("kitchen_garnitures")
        .select("name,design")
        .eq("id", body.sourceKitchenId)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return json({ error: "Таны хадгалсан загвар олдсонгүй." }, 404);
      snapshot = data.design;
      name = data.name;
    } else {
      const { data: design, error } = await db
        .from("kitchen_designs")
        .select("id")
        .eq("id", body.designId)
        .eq("store_id", store.id)
        .maybeSingle();
      if (error) throw error;
      if (!design) return json({ error: "Загвар олдсонгүй." }, 404);
      const { data: version, error: versionError } = await db
        .from("kitchen_design_versions")
        .select("title,design")
        .eq("id", body.versionId)
        .eq("design_id", design.id)
        .maybeSingle();
      if (versionError) throw versionError;
      if (!version) return json({ error: "Загварын хувилбар олдсонгүй." }, 404);
      snapshot = version.design;
      name = version.title;
    }
    const style =
      typeof body.style === "string" && /^[a-z0-9_-]{1,50}$/.test(body.style)
        ? body.style
        : "modern";
    const suggestions = kitchenListingSuggestions(snapshot, name, style);
    if (!suggestions)
      return json({ error: "Загварын бүрдлийг уншиж чадсангүй." }, 400);
    const safeList = (value: unknown) =>
      Array.isArray(value)
        ? value
            .filter(
              (item): item is string =>
                typeof item === "string" && item.length <= 200,
            )
            .slice(0, 50)
        : [];
    const result = await generateKitchenListingText(
      auth.userId,
      body.field as KitchenTextField,
      {
        title:
          typeof body.title === "string"
            ? body.title.trim().slice(0, 160) || name
            : name,
        style,
        layout: suggestions.layout,
        cabinetCount: suggestions.cabinetCount,
        widthMm: suggestions.widthMm,
        depthMm: suggestions.depthMm,
        materials: safeList(body.materials),
        inclusions: safeList(body.inclusions),
        exclusions: safeList(body.exclusions),
      },
    );
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      error instanceof SyntaxError ||
      /TOO_LARGE|size limit|exceeds/i.test(message)
    )
      return json(
        { error: "Хүсэлтийн өгөгдөл буруу эсвэл хэт том байна." },
        400,
      );
    return json(
      {
        error:
          message === "TEXT_QUOTA_EXCEEDED"
            ? "AI хүсэлтийн хязгаарт хүрлээ. Дараа дахин оролдоорой."
            : "AI тайлбар үүсгэж чадсангүй. Санал болгосон текстээс сонгох эсвэл өөрөө бичээрэй.",
      },
      message === "TEXT_QUOTA_EXCEEDED" ? 429 : 502,
    );
  }
}
