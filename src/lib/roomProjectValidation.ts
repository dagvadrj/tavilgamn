import type { DesignRoom, Material, PlacedFurniture, RoomDesign, RoomOpening, RoomWall } from "./types";
import { syncDesignRooms } from "./roomDesign";
import { validateRoomOpenings } from "./roomOpenings";
import { parseKitchen } from "./kitchenAssembly";

export const ROOM_PROJECT_MAX_BYTES = 1_000_000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type RoomProjectDocument = { schemaVersion: 1; design: RoomDesign };
export class RoomProjectInputError extends Error {}
const fail = (message: string): never => { throw new RoomProjectInputError(message); };
const walls: RoomWall[] = ["north", "east", "south", "west"];
const types = ["living", "bedroom", "kitchen", "bathroom", "office", "other"] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Загварын бүтэц буруу байна.");
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum = 100): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f]/.test(value)) return fail("Загварын нэр эсвэл таних утга буруу байна.");
  return value.trim();
}
function number(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) return fail("Хэмжээ, байрлал эсвэл гэрлийн утга зөвшөөрсөн хязгаараас гарсан байна.");
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) return fail("Загварын төрөл буруу байна.");
  return value as T;
}
function color(value: unknown): string {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return fail("Өнгө зургаан оронтой HEX байна.");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") return fail("Тохиргооны утга буруу байна.");
  return value;
}
function list<T>(value: unknown, maximum: number, parse: (item: unknown) => T, optional = true): T[] {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value) || value.length > maximum) return fail("Өрөөний объектын тоо хэтэрсэн байна.");
  return value.map(parse);
}
function unique(items: { id: string }[]) {
  if (new Set(items.map(item => item.id)).size !== items.length) fail("Давхардсан объектын ID байна.");
}
function piece(value: unknown): PlacedFurniture {
  const v = object(value);
  const result: PlacedFurniture = { instanceId: text(v.instanceId, 120), productId: text(v.productId, 160),
    x: number(v.x, -40, 40), z: number(v.z, -40, 40), rotation: number(v.rotation, -1000, 1000),
    color: text(v.color, 80), material: choice<Material>(v.material, ["wood", "metal", "fabric", "leather", "velvet"]) };
  if (v.modelId !== undefined) result.modelId = text(v.modelId, 120);
  if (v.kitchen !== undefined) {
    const kitchen = object(v.kitchen);
    // Keep the authored millimetres and immutable nested snapshot intact.
    result.kitchen = { id: text(kitchen.id, 120), name: text(kitchen.name), design: parseKitchen(kitchen.design) };
  }
  return result;
}
function room(value: unknown): DesignRoom {
  const v = object(value);
  const result: DesignRoom = { id: text(v.id, 120), name: text(v.name), type: choice(v.type, types),
    width: number(v.width, 1, 20), depth: number(v.depth, 1, 20), height: number(v.height ?? 2.7, 2, 5),
    wallColor: color(v.wallColor), floorColor: color(v.floorColor), pieces: list(v.pieces, 200, piece, false),
    wallFeatures: list(v.wallFeatures, 24, item => { const f = object(item); return { id: text(f.id, 120), wall: choice(f.wall, walls),
      kind: choice(f.kind, ["inset", "recess"]), offset: number(f.offset, 0, 20), length: number(f.length, .05, 20), depth: number(f.depth, .05, 3) }; }),
    columns: list(v.columns, 12, item => { const c = object(item); return { id: text(c.id, 120), x: number(c.x, 0, 20), z: number(c.z, 0, 20),
      width: number(c.width, .05, 20), depth: number(c.depth, .05, 20) }; }),
    openings: list<RoomOpening>(v.openings, 48, item => { const o = object(item); return { id: text(o.id, 120),
      kind: choice(o.kind, ["door", "window"]), templateId: text(o.templateId, 80), wallId: choice(o.wallId, walls),
      position: number(o.position, 0, 1), width: number(o.width, .1, 20), height: number(o.height, .1, 5), sillHeight: number(o.sillHeight, 0, 5),
      hinge: choice(o.hinge, ["left", "right"]), swing: choice(o.swing, ["inward", "outward"]), open: boolean(o.open) }; }),
  };
  for (const key of ["floorMaterial", "ceilingMaterial"] as const) if (v[key] !== undefined) result[key] = text(v[key], 80);
  if (v.wallMaterials !== undefined) {
    const materials = object(v.wallMaterials); result.wallMaterials = {};
    for (const wall of walls) if (materials[wall] !== undefined) { const m = object(materials[wall]); result.wallMaterials[wall] = {
      mode: choice(m.mode, ["color", "wallpaper"]), color: color(m.color), ...(m.materialId !== undefined ? { materialId: text(m.materialId, 80) } : {}),
    }; }
  }
  if (v.lighting !== undefined) {
    const lighting = object(v.lighting);
    result.lighting = { mode: choice(lighting.mode, ["day", "evening"]), ambient: number(lighting.ambient, 0, 3), sunlight: number(lighting.sunlight, 0, 10),
      fixtures: list(lighting.fixtures, 32, item => { const f = object(item); return { id: text(f.id, 120), x: number(f.x, -40, 40), z: number(f.z, -40, 40),
        intensity: number(f.intensity, 0, 20), color: color(f.color) }; }, false) };
    unique(result.lighting.fixtures);
  }
  unique(result.pieces.map(p => ({ id: p.instanceId })));
  unique(result.wallFeatures!); unique(result.columns!); unique(result.openings!);
  const issue = validateRoomOpenings(result);
  if (issue) fail(issue);
  return result;
}
/** Explicit legacy conversion; never casts an unknown persisted schema. */
export function parseRoomDesign(value: unknown): RoomDesign {
  const v = object(value), id = text(v.id, 120), name = text(v.name);
  if (v.schemaVersion !== undefined) fail("Room design envelope-ийг дэмжих хувилбараар нээнэ үү. Local эх загвар хэвээр байна.");
  const activeRoomId = v.activeRoomId === undefined ? `${id}-room-1` : text(v.activeRoomId, 120);
  const active = room({ ...v, id: activeRoomId, name: v.roomName ?? "Зочны өрөө", type: v.roomType ?? "living" });
  const rooms = list(v.rooms, 12, room);
  unique(rooms);
  if (rooms.length && !rooms.some(r => r.id === activeRoomId)) fail("Идэвхтэй өрөө загварт олдсонгүй.");
  if (rooms.length === 12 && !rooms.some(r => r.id === activeRoomId)) fail("12 хүртэл өрөө хадгална.");
  const design = syncDesignRooms({ ...active, id, name, size: choice(v.size, ["40", "80", "120"]),
    activeRoomId, roomName: active.name, roomType: active.type, rooms,
    createdAt: number(v.createdAt, 0, 8.64e15), updatedAt: number(v.updatedAt, 0, 8.64e15) });
  if (design.rooms!.reduce((n, r) => n + r.pieces.length, 0) > 500) fail("Нэг загварт 500 хүртэл тавилга хадгална.");
  return design;
}
export function parseRoomProject(value: unknown): RoomProjectDocument {
  const v = object(value);
  if (v.schemaVersion !== 1) fail("Энэ загварын хувилбарыг одоогийн editor дэмжихгүй. Local эх хувилбарыг хадгална уу.");
  return { schemaVersion: 1, design: parseRoomDesign(v.design) };
}
export function roomDocument(design: RoomDesign): RoomProjectDocument { return { schemaVersion: 1, design: parseRoomDesign(design) }; }
/** UI equality ignores the local bookkeeping timestamp, not design content. */
export function roomSignature(document: RoomProjectDocument): string {
  return JSON.stringify({ ...document, design: { ...document.design, updatedAt: 0 } });
}
export function parseRoomSave(value: unknown) {
  const v = object(value);
  if (typeof v.id !== "string" || !UUID_PATTERN.test(v.id) || typeof v.operationId !== "string" || !UUID_PATTERN.test(v.operationId)) fail("Project ID буруу байна.");
  if (!Number.isSafeInteger(v.expectedRevision) || (v.expectedRevision as number) < 0 || (v.expectedRevision as number) > 2_000_000_000) fail("Хувилбарын дугаар буруу байна.");
  const document = parseRoomProject(v.document);
  const name = text(v.name); document.design.name = name;
  const importKey = v.importKey === undefined ? null : text(v.importKey, 160);
  return { id: v.id as string, operationId: v.operationId as string, expectedRevision: v.expectedRevision as number, document,
    name, importKey, forceVersion: v.forceVersion === undefined ? false : boolean(v.forceVersion) };
}
