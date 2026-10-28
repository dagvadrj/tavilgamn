import { NextRequest, NextResponse } from "next/server";
import { requireMerchant } from "@/lib/supabase/requireMerchant";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { apiErrorResponse } from "@/lib/api/errors";
import { merchantHeaders } from "@/lib/merchantServer";
import {
  readTemplateDesign,
  readTemplateInput,
  templateId,
} from "@/lib/roomTemplates";
import type { RoomTemplateRow } from "@/lib/supabase/database";
import type { MerchantRoomAction } from "@/lib/merchantRooms";
import {
  contentFromInput,
  editableContent,
  merchantRoomColumns,
  merchantRoomsFromRows,
  merchantStoreId,
  type RoomContent,
} from "@/lib/merchantRoomsServer";
import { templateMissingModels } from "@/lib/roomTemplatesServer";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number, extra = {}) =>
  apiErrorResponse({ error, ...extra }, { status, headers: merchantHeaders });
const conflict = (row: Pick<RoomTemplateRow, "version" | "updated_at">) =>
  fail(
    "Өөр хүн энэ өрөөний шинэ хувилбар хадгалсан байна.",
    409,
    { conflict: { version: row.version, updatedAt: row.updated_at } },
  );

async function context(request: NextRequest) {
  const auth = await requireMerchant(request);
  if (auth.error) return { error: auth.error } as const;
  const db = getSupabaseAdmin();
  const storeId = await merchantStoreId(auth.userId, db);
  if (!storeId)
    return {
      error: fail("Идэвхтэй дэлгүүрийн бүртгэл шаардлагатай.", 403),
    } as const;
  return { db, storeId, userId: auth.userId } as const;
}
type Context = Exclude<Awaited<ReturnType<typeof context>>, { error: unknown }>;

async function ownRoom({ db, storeId }: Context, id: string) {
  const { data, error } = await db
    .from("room_templates")
    .select(merchantRoomColumns)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data as RoomTemplateRow | null;
}

const editable = (row: RoomTemplateRow) => {
  const content = editableContent(row);
  return {
    id: row.id,
    version: row.version,
    title: content.title,
    description: content.description,
    furnishing: content.furnishing,
    roomType: content.room_type,
    previewImage: content.preview_image,
    design: readTemplateDesign(content.design),
  };
};

export async function GET(request: NextRequest) {
  try {
    const ctx = await context(request);
    if ("error" in ctx) return ctx.error;
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      if (!templateId(id)) return fail("Өрөөний дугаар буруу байна.", 400);
      const row = await ownRoom(ctx, id);
      if (!row) return fail("Өрөө олдсонгүй.", 404);
      const [room] = await merchantRoomsFromRows([row], ctx.db);
      return NextResponse.json(
        { room, template: editable(row) },
        { headers: merchantHeaders },
      );
    }
    const { data, error } = await ctx.db
      .from("room_templates")
      .select(merchantRoomColumns)
      .eq("store_id", ctx.storeId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json(
      { rooms: await merchantRoomsFromRows(data as RoomTemplateRow[], ctx.db) },
      { headers: merchantHeaders },
    );
  } catch {
    return fail("Тохижуулсан өрөөнүүдийг ачаалж чадсангүй.", 503);
  }
}

/**
 * «Ноорог хадгалах». A published room keeps its public version; the edit goes
 * to `draft` until «Нийтлэх». A stale `version` is a conflict, never an overwrite.
 */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await context(request);
    if ("error" in ctx) return ctx.error;
    const raw = await request.text();
    if (raw.length > 2_500_000) return fail("Хүсэлт хэт том байна.", 413);
    let input;
    try {
      input = readTemplateInput({
        ...JSON.parse(raw),
        status: "draft",
        sortOrder: 0,
      });
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Өгөгдөл буруу байна.",
        400,
      );
    }
    const content = contentFromInput(input);
    const now = new Date().toISOString();
    if (!input.id) {
      const { data, error } = await ctx.db
        .from("room_templates")
        .insert({
          ...content,
          store_id: ctx.storeId,
          status: "draft",
          sort_order: 0,
          updated_by: ctx.userId,
          updated_at: now,
        })
        .select(merchantRoomColumns)
        .single();
      if (error) throw error;
      const row = data as RoomTemplateRow;
      const [room] = await merchantRoomsFromRows([row], ctx.db);
      return NextResponse.json(
        { room, template: editable(row) },
        { headers: merchantHeaders },
      );
    }
    const current = await ownRoom(ctx, input.id);
    if (!current) return fail("Өрөө олдсонгүй.", 404);
    if (current.version !== input.version) return conflict(current);
    const next = input.version + 1;
    const patch =
      current.status === "published"
        ? { draft: content as unknown as RoomTemplateRow["draft"], draft_version: next }
        : { ...content, draft: null, draft_version: null };
    const { data, error } = await ctx.db
      .from("room_templates")
      .update({ ...patch, version: next, updated_by: ctx.userId, updated_at: now })
      .eq("id", input.id)
      .eq("store_id", ctx.storeId)
      .eq("version", input.version)
      .select(merchantRoomColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const latest = await ownRoom(ctx, input.id);
      return latest ? conflict(latest) : fail("Өрөө олдсонгүй.", 404);
    }
    const row = data as RoomTemplateRow;
    const [room] = await merchantRoomsFromRows([row], ctx.db);
    return NextResponse.json(
      { room, template: editable(row) },
      { headers: merchantHeaders },
    );
  } catch {
    return fail("Өрөөг хадгалж чадсангүй. Дахин оролдоно уу.", 503);
  }
}

const ACTIONS: MerchantRoomAction[] = [
  "duplicate",
  "publish",
  "unpublish",
  "archive",
  "restore",
];

/** «•••» actions and «Нийтлэх» from the editor. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await context(request);
    if ("error" in ctx) return ctx.error;
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      version?: unknown;
      action?: unknown;
    } | null;
    if (
      !body ||
      typeof body.id !== "string" ||
      !templateId(body.id) ||
      !Number.isInteger(body.version) ||
      !ACTIONS.includes(body.action as MerchantRoomAction)
    )
      return fail("Хүсэлт буруу байна.", 400);
    const action = body.action as MerchantRoomAction;
    const current = await ownRoom(ctx, body.id);
    if (!current) return fail("Өрөө олдсонгүй.", 404);
    if (current.version !== body.version) return conflict(current);
    const content = editableContent(current);
    const now = new Date().toISOString();
    if (action === "duplicate") {
      const { data, error } = await ctx.db
        .from("room_templates")
        .insert({
          ...content,
          title: `${content.title} (хуулбар)`.slice(0, 100),
          preview_image: "",
          store_id: ctx.storeId,
          status: "draft",
          sort_order: 0,
          updated_by: ctx.userId,
          updated_at: now,
        })
        .select(merchantRoomColumns)
        .single();
      if (error) throw error;
      const [room] = await merchantRoomsFromRows([data as RoomTemplateRow], ctx.db);
      return NextResponse.json({ room }, { headers: merchantHeaders });
    }
    const next = current.version + 1;
    let patch: Partial<RoomTemplateRow>;
    if (action === "publish") {
      const design = readTemplateDesign(content.design);
      const [missing] = await templateMissingModels([design], ctx.db);
      if (missing)
        return fail(
          `${missing} тавилгын 3D загвар олдсонгүй. Editor-т засаад нийтэлнэ үү.`,
          422,
        );
      if (!content.title.trim() || !content.preview_image)
        return fail(
          "Нэр болон cover зураг бэлэн болсны дараа нийтэлнэ үү.",
          422,
        );
      patch = {
        ...(content as RoomContent),
        status: "published",
        published_version: next,
        draft: null,
        draft_version: null,
      };
    } else
      // Leaving the gallery folds a pending edit into the main version.
      patch = {
        ...(content as RoomContent),
        status: action === "archive" ? "archived" : "draft",
        draft: null,
        draft_version: null,
      };
    const { data, error } = await ctx.db
      .from("room_templates")
      .update({ ...patch, version: next, updated_by: ctx.userId, updated_at: now })
      .eq("id", body.id)
      .eq("store_id", ctx.storeId)
      .eq("version", current.version)
      .select(merchantRoomColumns)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const latest = await ownRoom(ctx, body.id);
      return latest ? conflict(latest) : fail("Өрөө олдсонгүй.", 404);
    }
    const [room] = await merchantRoomsFromRows([data as RoomTemplateRow], ctx.db);
    return NextResponse.json({ room }, { headers: merchantHeaders });
  } catch {
    return fail("Үйлдлийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.", 503);
  }
}
