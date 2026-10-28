import type { RoomDesign, RoomType } from "./types";
import { syncDesignRooms } from "./roomDesign";
import { getRoomGeometry, ROOM_TYPES, validateRoomShape } from "./roomGeometry";
import { validateRoomOpenings } from "./roomOpenings";
import { parseKitchen } from "./kitchenAssembly";

export type RoomTemplateKind = "empty" | "furnished";
export type RoomTemplateStatus = "draft" | "published" | "archived";
export interface RoomTemplateCard {
  id: string;
  title: string;
  description: string;
  kind: RoomTemplateKind;
  furnishing: "full" | "partial";
  roomType: RoomType;
  area: number;
  previewImage: string;
  sortOrder: number;
  status: RoomTemplateStatus;
  version: number;
  /** Owning merchant store; null/absent for the platform's starter templates. */
  storeId?: string | null;
  pieceCount?: number;
  /** Footprint of the main room in metres, for «5 × 4 м». */
  width?: number | null;
  depth?: number | null;
}
export interface RoomTemplate extends RoomTemplateCard {
  design: RoomDesign;
}
export const templateId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** A bounded JSON document; browser-local assets cannot become public templates. */
function validJson(value: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number")
    return Number.isFinite(value) && Math.abs(value) < 1e15;
  if (typeof value === "string")
    return (
      value.length < 10000 && !/^(?:blob:|file:|javascript:|data:)/i.test(value)
    );
  if (Array.isArray(value))
    return (
      value.length <= 1000 && value.every((item) => validJson(item, depth + 1))
    );
  return (
    object(value) &&
    Object.entries(value).every(
      ([key, item]) =>
        !["__proto__", "prototype", "constructor"].includes(key) &&
        (item === undefined || validJson(item, depth + 1)),
    )
  );
}
export function readTemplateDesign(value: unknown): RoomDesign {
  if (!object(value)) throw new Error("Өрөөний өгөгдөл буруу байна.");
  const raw = { ...value };
  delete raw.previewImage;
  if (
    !validJson(raw) ||
    JSON.stringify(raw).length > 1500000 ||
    !text(raw.id, 160) ||
    !text(raw.name, 120) ||
    !["40", "80", "120"].includes(String(raw.size)) ||
    !Array.isArray(raw.pieces)
  )
    throw new Error("Өрөөний өгөгдөл хэт том эсвэл дутуу байна.");
  try {
    const design = syncDesignRooms(raw as unknown as RoomDesign);
    if (!design.rooms?.length || design.rooms.length > 12) throw new Error();
    const pieceIds = new Set<string>();
    const roomIds = new Set<string>();
    let count = 0;
    for (const room of design.rooms) {
      if (
        !text(room.id, 160) ||
        roomIds.has(room.id) ||
        !text(room.name, 120) ||
        !Object.hasOwn(ROOM_TYPES, room.type) ||
        !text(room.wallColor, 40) ||
        !text(room.floorColor, 40) ||
        validateRoomShape(room) ||
        validateRoomOpenings(room)
      )
        throw new Error();
      roomIds.add(room.id);
      for (const piece of room.pieces) {
        if (
          ++count > 300 ||
          !text(piece.instanceId, 160) ||
          pieceIds.has(piece.instanceId) ||
          !text(piece.productId, 160) ||
          ![piece.x, piece.z, piece.rotation, piece.elevation ?? 0].every(
            (n) => Number.isFinite(n) && Math.abs(n) <= 1000,
          ) ||
          !text(piece.color, 40) ||
          !text(piece.material, 40)
        )
          throw new Error();
        pieceIds.add(piece.instanceId);
        if (piece.kitchen)
          piece.kitchen = {
            ...piece.kitchen,
            design: parseKitchen(piece.kitchen.design),
          };
      }
    }
    return design;
  } catch {
    throw new Error(
      "Өрөөний хэлбэр, нээлхий эсвэл тавилгын мэдээлэл буруу байна.",
    );
  }
}
export function readTemplateInput(value: unknown) {
  if (
    !object(value) ||
    !text(value.title, 100) ||
    typeof value.description !== "string" ||
    value.description.length > 500 ||
    !["draft", "published", "archived"].includes(String(value.status)) ||
    !["full", "partial"].includes(String(value.furnishing)) ||
    !Number.isInteger(value.sortOrder) ||
    Math.abs(Number(value.sortOrder)) > 10000
  )
    throw new Error("Нэр, тайлбар, нийтлэх төлөвөө шалгана уу.");
  if (value.id !== undefined && !templateId(value.id))
    throw new Error("Загварын дугаар буруу байна.");
  if (
    value.id &&
    (!Number.isInteger(value.version) || Number(value.version) < 1)
  )
    throw new Error("Загварын хувилбар буруу байна.");
  const design = readTemplateDesign(value.design);
  const previewImage =
    typeof value.previewImage === "string" ? value.previewImage : "";
  if (
    previewImage &&
    (previewImage.length > 600000 ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
        previewImage,
      ))
  )
    throw new Error("Өрөөний зургийн формат эсвэл хэмжээ буруу байна.");
  if (value.status === "published" && !previewImage)
    throw new Error("3D өрөөний зураг бэлэн болсны дараа нийтэлнэ үү.");
  return {
    id: value.id as string | undefined,
    version: Number(value.version || 0),
    title: value.title.trim(),
    description: value.description.trim(),
    status: value.status as RoomTemplateStatus,
    furnishing: value.furnishing as "full" | "partial",
    sortOrder: Number(value.sortOrder),
    previewImage,
    design,
    kind: (design.rooms!.some((room) => room.pieces.length)
      ? "furnished"
      : "empty") as RoomTemplateKind,
    roomType:
      typeof value.roomType === "string" && Object.hasOwn(ROOM_TYPES, value.roomType)
        ? (value.roomType as RoomType)
        : (design.roomType ?? "living"),
    area: design.rooms!.reduce(
      (sum, room) => sum + getRoomGeometry(room).area,
      0,
    ),
  };
}

/** Counts and footprint kept beside the design so gallery cards stay small. */
export function templateStats(design: RoomDesign) {
  const rooms = design.rooms ?? [];
  return {
    pieceCount: rooms.reduce((sum, room) => sum + room.pieces.length, 0),
    width: Number.isFinite(design.width) && design.width > 0 ? design.width : null,
    depth: Number.isFinite(design.depth) && design.depth > 0 ? design.depth : null,
  };
}

/** «5 × 4 м» from a card's footprint; empty when unknown. */
export function templateFootprint(card: Pick<RoomTemplateCard, "width" | "depth">) {
  if (!card.width || !card.depth) return "";
  const metre = (value: number) => String(Math.round(value * 10) / 10);
  return `${metre(card.width)} × ${metre(card.depth)} м`;
}

/** Copy identity and all structural references; catalog/model identifiers stay stable. */
export function instantiateRoomTemplate(
  source: RoomDesign,
  name = source.name,
): RoomDesign {
  const design = readTemplateDesign(source);
  const ids = new Map<string, string>();
  const identity = new Set(["id", "instanceId", "segmentId"]);
  const references = new Set([
    ...identity,
    "roomId",
    "activeRoomId",
    "roomA",
    "roomB",
    "parentInstanceId",
  ]);
  function visit(value: unknown, replace: boolean): unknown {
    if (Array.isArray(value)) return value.map((item) => visit(item, replace));
    if (!object(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (["kitchen", "details", "placement"].includes(key))
          return [key, structuredClone(item)];
        if (
          typeof item === "string" &&
          (replace ? references : identity).has(key)
        ) {
          if (!replace && !ids.has(item)) ids.set(item, crypto.randomUUID());
          return [key, replace ? (ids.get(item) ?? item) : item];
        }
        return [key, visit(item, replace)];
      }),
    );
  }
  visit(design, false);
  const copy = visit(design, true) as RoomDesign;
  copy.name = name;
  copy.createdAt = copy.updatedAt = Date.now();
  delete copy.previewImage;
  return syncDesignRooms(copy);
}

export const GALLERY_PAGE_SIZE = 24;
export type GalleryFurnishing = "full" | "partial";
/** Public gallery query: store id or "platform", room type, furnishing, page. */
export function readGalleryFilter(params: URLSearchParams) {
  const store = params.get("store") ?? "";
  const type = params.get("type") ?? "";
  const furnishing = params.get("furnishing") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  const limit = Number(params.get("limit") ?? GALLERY_PAGE_SIZE);
  if (
    (store && store !== "platform" && !/^[\w-]{1,80}$/.test(store)) ||
    (type && !Object.hasOwn(ROOM_TYPES, type)) ||
    (furnishing && !["full", "partial"].includes(furnishing)) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 5000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return null;
  return {
    store,
    type: type as RoomType | "",
    furnishing: furnishing as GalleryFurnishing | "",
    offset,
    limit,
  };
}
