import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/requireAdmin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { apiErrorResponse, privateHeaders } from "@/lib/api/errors";
import { readTemplateInput, templateId } from "@/lib/roomTemplates";
import {
  roomTemplate,
  roomTemplateCard,
  templateCardColumns,
  templateAssetsAvailable,
} from "@/lib/roomTemplatesServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    const id = request.nextUrl.searchParams.get("id");
    if (id && !templateId(id))
      return apiErrorResponse(
        { error: "Загварын дугаар буруу байна." },
        { status: 400 },
      );
    const db = getSupabaseAdmin();
    if (id) {
      const { data, error } = await db
        .from("room_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return apiErrorResponse({ error: "Өрөө олдсонгүй." }, { status: 404 });
      return NextResponse.json(
        { template: roomTemplate(data) },
        { headers: privateHeaders },
      );
    }
    const { data, error } = await db
      .from("room_templates")
      .select(templateCardColumns)
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json(
      { templates: data.map(roomTemplateCard) },
      { headers: privateHeaders },
    );
  } catch {
    return apiErrorResponse(
      { error: "Бэлэн өрөөний санг ачаалж чадсангүй." },
      { status: 503 },
    );
  }
}
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;
    if (Number(request.headers.get("content-length") || 0) > 2500000)
      return apiErrorResponse(
        { error: "Хүсэлт хэт том байна." },
        { status: 413 },
      );
    const raw = await request.text();
    if (raw.length > 2500000)
      return apiErrorResponse(
        { error: "Хүсэлт хэт том байна." },
        { status: 413 },
      );
    let input;
    try {
      input = readTemplateInput(JSON.parse(raw));
    } catch (error) {
      return apiErrorResponse(
        {
          error:
            error instanceof Error ? error.message : "Өгөгдөл буруу байна.",
        },
        { status: 400 },
      );
    }
    const row = {
      title: input.title,
      description: input.description,
      kind: input.kind,
      furnishing: input.furnishing,
      room_type: input.roomType,
      area: input.area,
      preview_image: input.previewImage,
      design: toJson(input.design),
      status: input.status,
      sort_order: input.sortOrder,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
      version: input.version + 1,
    };
    const db = getSupabaseAdmin();
    if (
      input.status === "published" &&
      !(await templateAssetsAvailable(input.design, db))
    )
      return apiErrorResponse(
        {
          error:
            "Зохиомжийн зарим тавилга нийтэд нээлттэй 3D загваргүй байна. Тавилгаа сангаас дахин сонгоод нийтэлнэ үү.",
        },
        { status: 422 },
      );
    const result = input.id
      ? await db
          .from("room_templates")
          .update(row)
          .eq("id", input.id)
          .eq("version", input.version)
          .select("*")
          .maybeSingle()
      : await db.from("room_templates").insert(row).select("*").single();
    if (result.error) throw result.error;
    if (!result.data)
      return apiErrorResponse(
        {
          error:
            "Өөр админ шинэчилсэн байна. Дахин нээгээд өөрчлөлтөө хадгална уу.",
        },
        { status: 409 },
      );
    return NextResponse.json(
      { template: roomTemplate(result.data) },
      { headers: privateHeaders },
    );
  } catch {
    return apiErrorResponse(
      { error: "Өрөөг хадгалж чадсангүй. Дахин оролдоно уу." },
      { status: 503 },
    );
  }
}
