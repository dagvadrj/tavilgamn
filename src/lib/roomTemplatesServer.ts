import "server-only";
import type { RoomTemplateCard, RoomTemplate } from "./roomTemplates";
import { readTemplateDesign } from "./roomTemplates";
import type { RoomDesign } from "./types";
import { templateId } from "./roomTemplates";
import { getSupabaseAdmin } from "./supabase/admin";
import type { RoomTemplateRow } from "./supabase/database";
export const templateCardColumns =
  "id,title,description,kind,furnishing,room_type,area,preview_image,status,sort_order,version";
export function roomTemplateCard(
  row: Omit<
    RoomTemplateRow,
    "design" | "created_at" | "updated_at" | "updated_by"
  >,
): RoomTemplateCard {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind as RoomTemplateCard["kind"],
    furnishing: row.furnishing as RoomTemplateCard["furnishing"],
    roomType: row.room_type as RoomTemplateCard["roomType"],
    area: row.area,
    previewImage: row.preview_image,
    status: row.status as RoomTemplateCard["status"],
    sortOrder: row.sort_order,
    version: row.version,
  };
}
export function roomTemplate(row: RoomTemplateRow): RoomTemplate {
  return { ...roomTemplateCard(row), design: readTemplateDesign(row.design) };
}

/** A public template cannot depend on retired or missing furniture deliveries. */
export async function templateAssetsAvailable(
  design: RoomDesign,
  db = getSupabaseAdmin(),
) {
  const pieces = (design.rooms ?? [])
    .flatMap((room) => room.pieces)
    .filter((piece) => !piece.kitchen);
  if (!pieces.length) return true;
  const keys = [
    ...new Set(
      pieces.flatMap((piece) => [
        piece.productId,
        ...(piece.modelId ? [piece.modelId] : []),
      ]),
    ),
  ];
  const uuidKeys = keys.filter(templateId);
  const columns = "id,product_id,glb_path,archived_at";
  const results = await Promise.all([
    db
      .from("furniture_models")
      .select(columns)
      .in("product_id", keys)
      .is("archived_at", null),
    uuidKeys.length
      ? db
          .from("furniture_models")
          .select(columns)
          .in("id", uuidKeys)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const rows = results
    .flatMap((result) => result.data ?? [])
    .filter((row) => row.glb_path);
  return pieces.every((piece) =>
    rows.some((row) =>
      piece.modelId
        ? row.id === piece.modelId || row.product_id === piece.modelId
        : row.product_id === piece.productId,
    ),
  );
}
