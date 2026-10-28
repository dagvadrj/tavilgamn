import "server-only";
import type { RoomDesign } from "./types";
import type { Json } from "./supabase/database.types";
import type { RoomTemplateRow } from "./supabase/database";
import { getSupabaseAdmin } from "./supabase/admin";
import { readTemplateDesign, templateStats } from "./roomTemplates";
import type { MerchantRoom } from "./merchantRooms";
import { templateMissingModels } from "./roomTemplatesServer";

/** Content of one room version: what shoppers see, or the merchant's pending edit. */
export interface RoomContent {
  title: string;
  description: string;
  furnishing: "full" | "partial";
  room_type: string;
  kind: string;
  area: number;
  preview_image: string;
  design: Json;
  piece_count: number;
  width: number | null;
  depth: number | null;
}

export const merchantRoomColumns =
  "id,title,description,kind,furnishing,room_type,area,preview_image,design,status,sort_order,version,updated_by,created_at,updated_at,store_id,published_version,draft,draft_version,piece_count,width,depth";

/** A store's own rooms are editable only by its active owner. */
export async function merchantStoreId(userId: string, db = getSupabaseAdmin()) {
  const { data, error } = await db
    .from("merchant_stores")
    .select("id")
    .eq("owner_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

const isContent = (value: unknown): value is RoomContent =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof (value as RoomContent).title === "string" &&
  !!(value as RoomContent).design;

/** The version the merchant is editing: the pending draft, else the main columns. */
export function editableContent(row: RoomTemplateRow): RoomContent {
  if (isContent(row.draft)) return row.draft;
  return {
    title: row.title,
    description: row.description,
    furnishing: row.furnishing as RoomContent["furnishing"],
    room_type: row.room_type,
    kind: row.kind,
    area: row.area,
    preview_image: row.preview_image,
    design: row.design,
    piece_count: row.piece_count,
    width: row.width,
    depth: row.depth,
  };
}

export function contentFromInput(input: {
  title: string;
  description: string;
  furnishing: "full" | "partial";
  roomType: string;
  kind: string;
  area: number;
  previewImage: string;
  design: RoomDesign;
}): RoomContent {
  const stats = templateStats(input.design);
  return {
    title: input.title,
    description: input.description,
    furnishing: input.furnishing,
    room_type: input.roomType,
    kind: input.kind,
    area: input.area,
    preview_image: input.previewImage,
    design: input.design as unknown as Json,
    piece_count: stats.pieceCount,
    width: stats.width,
    depth: stats.depth,
  };
}

export async function merchantRoomsFromRows(
  rows: RoomTemplateRow[],
  db = getSupabaseAdmin(),
): Promise<MerchantRoom[]> {
  const designs = rows.map((row) => {
    try {
      return readTemplateDesign(editableContent(row).design);
    } catch {
      return null;
    }
  });
  const missing = await templateMissingModels(
    designs.map((design) => design ?? ({ rooms: [] } as unknown as RoomDesign)),
    db,
  );
  return rows.map((row, index) => {
    const content = editableContent(row);
    return {
      id: row.id,
      title: content.title,
      description: content.description,
      roomType: content.room_type as MerchantRoom["roomType"],
      area: content.area,
      furnishing: content.furnishing,
      status: row.status as MerchantRoom["status"],
      version: row.version,
      publishedVersion: row.published_version,
      draftVersion: row.draft_version,
      updatedAt: row.updated_at,
      previewImage:
        row.status === "published"
          ? `/api/room-templates/preview?id=${row.id}`
          : "",
      pieceCount: content.piece_count,
      width: content.width,
      depth: content.depth,
      // An unreadable design cannot be published either.
      missingModels: designs[index] ? missing[index] : Math.max(1, content.piece_count),
    };
  });
}
