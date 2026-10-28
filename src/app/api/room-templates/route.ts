import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { readGalleryFilter, templateId } from "@/lib/roomTemplates";
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
    // C1: filters run on the server so «Цааш ачаалах» pages stay consistent.
    const params = request.nextUrl.searchParams;
    const filter = readGalleryFilter(params);
    if (!filter)
      return apiErrorResponse(
        { error: "Шүүлтүүр буруу байна." },
        { status: 400 },
      );
    let query = db
      .from("room_templates")
      .select(
        "id,title,description,kind,furnishing,room_type,area,status,sort_order,version,store_id,piece_count,width,depth",
      )
      .eq("status", "published");
    if (filter.store === "platform") query = query.is("store_id", null);
    else if (filter.store) query = query.eq("store_id", filter.store);
    if (filter.type) query = query.eq("room_type", filter.type);
    if (filter.furnishing) query = query.eq("furnishing", filter.furnishing);
    const [page, owners] = await Promise.all([
      query
        .order("store_id", { nullsFirst: false })
        .order("sort_order")
        .order("created_at", { ascending: false })
        .range(filter.offset, filter.offset + filter.limit),
      // Per-store totals for «N тохижуулсан өрөө» ignore the room filters.
      db
        .from("room_templates")
        .select("store_id")
        .eq("status", "published")
        .limit(2000),
    ]);
    if (page.error) throw page.error;
    if (owners.error) throw owners.error;
    const counts = new Map<string, number>();
    for (const row of owners.data)
      if (row.store_id)
        counts.set(row.store_id, (counts.get(row.store_id) ?? 0) + 1);
    const ids = [...counts.keys()];
    const stores = ids.length
      ? await db
          .from("merchant_stores")
          .select("id,name,image")
          .in("id", ids)
          .eq("active", true)
      : { data: [], error: null };
    if (stores.error) throw stores.error;
    const active = new Set(stores.data.map((store) => store.id));
    const rows = page.data
      .slice(0, filter.limit)
      // A deactivated store's rooms leave the public gallery with the store.
      .filter((row) => !row.store_id || active.has(row.store_id));
    return NextResponse.json(
      {
        templates: rows.map((row) =>
          roomTemplateCard({
            ...row,
            preview_image: `/api/room-templates/preview?id=${row.id}`,
          }),
        ),
        stores: stores.data.map((store) => ({
          id: store.id,
          name: store.name,
          image: store.image,
          roomCount: counts.get(store.id) ?? 0,
        })),
        hasMore: page.data.length > filter.limit,
        nextOffset: filter.offset + filter.limit,
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
