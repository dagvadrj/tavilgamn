import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { templateId } from "@/lib/roomTemplates";
import {
  roomTemplate,
  roomTemplateCard,
  templateAssetsAvailable,
} from "@/lib/roomTemplatesServer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id && !templateId(id))
    return apiErrorResponse(
      { error: "Загварын дугаар буруу байна." },
      { status: 400 },
    );
  try {
    const db = getSupabaseAdmin();
    if (id) {
      const { data, error } = await db
        .from("room_templates")
        .select("*")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        return apiErrorResponse(
          { error: "Энэ өрөө одоо нийтлэгдээгүй байна." },
          { status: 404 },
        );
      const template = roomTemplate(data);
      if (!(await templateAssetsAvailable(template.design, db)))
        return apiErrorResponse(
          {
            error:
              "Энэ зохиомжийн тавилга шинэчлэгдэж байна. Өөр өрөө сонгоно уу.",
          },
          { status: 422 },
        );
      return NextResponse.json(
        {
          template: {
            ...template,
            previewImage: `/api/room-templates/preview?id=${id}`,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data, error } = await db
      .from("room_templates")
      .select(
        "id,title,description,kind,furnishing,room_type,area,status,sort_order,version",
      )
      .eq("status", "published")
      .order("sort_order")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json(
      {
        templates: data.map((row) =>
          roomTemplateCard({
            ...row,
            preview_image: `/api/room-templates/preview?id=${row.id}`,
          }),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiErrorResponse(
      { error: "Бэлэн өрөөнүүдийг ачаалж чадсангүй. Дахин оролдоно уу." },
      { status: 503 },
    );
  }
}
