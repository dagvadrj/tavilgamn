import "server-only";
import type { RoomTemplateCard, RoomTemplate } from "./roomTemplates";
import { readTemplateDesign } from "./roomTemplates";
import type { RoomDesign } from "./types";
import { templateId } from "./roomTemplates";
import { getSupabaseAdmin } from "./supabase/admin";
import type { RoomTemplateRow } from "./supabase/database";
export const templateCardColumns =
  "id,title,description,kind,furnishing,room_type,area,preview_image,status,sort_order,version,store_id,piece_count,width,depth";
type CardRow = Omit<
  RoomTemplateRow,
  | "design"
  | "created_at"
  | "updated_at"
  | "updated_by"
  | "store_id"
  | "published_version"
  | "draft"
  | "draft_version"
  | "piece_count"
  | "width"
  | "depth"
> &
  Partial<
    Pick<RoomTemplateRow, "store_id" | "piece_count" | "width" | "depth">
  >;
export function roomTemplateCard(row: CardRow): RoomTemplateCard {
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
    storeId: row.store_id ?? null,
    pieceCount: row.piece_count ?? 0,
    width: row.width ?? null,
    depth: row.depth ?? null,
  };
}
export function roomTemplate(row: RoomTemplateRow): RoomTemplate {
  return { ...roomTemplateCard(row), design: readTemplateDesign(row.design) };
}

const templatePieces = (design: RoomDesign) =>
  (design.rooms ?? [])
    .flatMap((room) => room.pieces)
    .filter((piece) => !piece.kitchen);

/**
 * Number of placed pieces per design whose 3D delivery is retired or missing.
 * One query pair covers every design, so merchant lists stay a single round trip.
 */
export async function templateMissingModels(
  designs: RoomDesign[],
  db = getSupabaseAdmin(),
) {
  const pieces = designs.map(templatePieces);
  const keys = [
    ...new Set(
      pieces
        .flat()
        .flatMap((piece) => [
          piece.productId,
          ...(piece.modelId ? [piece.modelId] : []),
        ]),
    ),
  ];
  if (!keys.length) return designs.map(() => 0);
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
  return pieces.map(
    (list) =>
      list.filter(
        (piece) =>
          !rows.some((row) =>
            piece.modelId
              ? row.id === piece.modelId || row.product_id === piece.modelId
              : row.product_id === piece.productId,
          ),
      ).length,
  );
}

/** A public template cannot depend on retired or missing furniture deliveries. */
export async function templateAssetsAvailable(
  design: RoomDesign,
  db = getSupabaseAdmin(),
) {
  const [missing] = await templateMissingModels([design], db);
  return missing === 0;
}
