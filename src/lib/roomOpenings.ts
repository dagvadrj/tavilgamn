import type { RoomOpening, RoomShape, RoomWall } from "./types";
import { getRoomGeometry, validateRoomShape } from "./roomGeometry";

/** Space reserved outside the clear opening for the frame. */
export const OPENING_FRAME_MARGIN = 0.06;
const EPSILON = 0.000001;
const WALLS: RoomWall[] = ["north", "east", "south", "west"];

export interface OpeningTemplate {
  id: string;
  label: string;
  kind: RoomOpening["kind"];
  width: number;
  height: number;
  sillHeight: number;
}

export const OPENING_TEMPLATES: OpeningTemplate[] = [
  { id: "door-single", label: "Нэг хавтаст хаалга", kind: "door", width: 0.9, height: 2.1, sillHeight: 0 },
  { id: "door-double", label: "Хоёр хавтаст хаалга", kind: "door", width: 1.6, height: 2.1, sillHeight: 0 },
  { id: "window-fixed", label: "Битүү цонх", kind: "window", width: 1.2, height: 1.2, sillHeight: 0.9 },
  { id: "window-sliding", label: "Гүйдэг цонх", kind: "window", width: 1.8, height: 1.2, sillHeight: 0.9 },
];

export function createOpening(templateId: string, wallId: RoomWall, position = 0.5): RoomOpening {
  const template = OPENING_TEMPLATES.find(item => item.id === templateId);
  if (!template) throw new Error("Хаалга, цонхны загвар олдсонгүй.");
  return { id: `opening_${crypto.randomUUID()}`, templateId, kind: template.kind, wallId, position,
    width: template.width, height: template.height, sillHeight: template.sillHeight,
    hinge: "left", swing: "inward", open: false };
}

export function wallLength(room: RoomShape, wallId: RoomWall): number {
  return wallId === "north" || wallId === "south" ? room.width : room.depth;
}

/** Local +x follows A→B→C→D clockwise; local +z always faces the interior. */
export function openingWorldTransform(room: RoomShape, opening: Pick<RoomOpening, "wallId" | "position">): { x: number; z: number; rotation: number } {
  const along = wallLength(room, opening.wallId) * opening.position;
  switch (opening.wallId) {
    case "north": return { x: -room.width / 2 + along, z: -room.depth / 2, rotation: 0 };
    case "east": return { x: room.width / 2, z: -room.depth / 2 + along, rotation: -Math.PI / 2 };
    case "south": return { x: room.width / 2 - along, z: room.depth / 2, rotation: Math.PI };
    case "west": return { x: -room.width / 2, z: room.depth / 2 - along, rotation: Math.PI / 2 };
  }
}

function openingError(opening: RoomOpening): string | null {
  if (!opening || typeof opening.id !== "string" || !opening.id.trim() || !WALLS.includes(opening.wallId)) return "Хаалга, цонхны дугаар болон ханыг зөв сонгоно уу.";
  const template = OPENING_TEMPLATES.find(item => item.id === opening.templateId);
  if (!template || template.kind !== opening.kind) return "Хаалга, цонхны загвар тохирохгүй байна.";
  if (![opening.width, opening.height, opening.sillHeight, opening.position].every(Number.isFinite)) return "Хаалга, цонхны хэмжээнд зөв тоо оруулна уу.";
  if (opening.width < 0.3 || opening.height < 0.3 || opening.sillHeight < 0 || opening.position < 0 || opening.position > 1) return "Хаалга, цонхны хэмжээ 30 см-ээс эхэлж, байрлал хананы дотор байна.";
  if (opening.kind === "door" && Math.abs(opening.sillHeight) > EPSILON) return "Хаалга шалнаас эхэлнэ.";
  if (!["left", "right"].includes(opening.hinge) || !["inward", "outward"].includes(opening.swing) || typeof opening.open !== "boolean") return "Хаалганы нээгдэх чиглэлийг зөв сонгоно уу.";
  return null;
}

function spans(room: RoomShape, opening: RoomOpening) {
  const center = wallLength(room, opening.wallId) * opening.position;
  return { left: center - opening.width / 2 - OPENING_FRAME_MARGIN, right: center + opening.width / 2 + OPENING_FRAME_MARGIN,
    bottom: Math.max(0, opening.sillHeight - OPENING_FRAME_MARGIN), top: opening.sillHeight + opening.height + OPENING_FRAME_MARGIN };
}

/** Actual base-wall perimeter intervals also account for adjacent-wall corner cuts. */
function availableWallSpans(room: RoomShape, wallId: RoomWall): { start: number; end: number }[] {
  const halfWidth = room.width / 2, halfDepth = room.depth / 2;
  return getRoomGeometry(room).segments.flatMap(segment => {
    let a: number, b: number;
    switch (wallId) {
      case "north":
        if (Math.abs(segment.a.z + halfDepth) > EPSILON || Math.abs(segment.b.z + halfDepth) > EPSILON || segment.nz < 0.99) return [];
        a = segment.a.x + halfWidth; b = segment.b.x + halfWidth; break;
      case "east":
        if (Math.abs(segment.a.x - halfWidth) > EPSILON || Math.abs(segment.b.x - halfWidth) > EPSILON || segment.nx > -0.99) return [];
        a = segment.a.z + halfDepth; b = segment.b.z + halfDepth; break;
      case "south":
        if (Math.abs(segment.a.z - halfDepth) > EPSILON || Math.abs(segment.b.z - halfDepth) > EPSILON || segment.nz > -0.99) return [];
        a = halfWidth - segment.a.x; b = halfWidth - segment.b.x; break;
      case "west":
        if (Math.abs(segment.a.x + halfWidth) > EPSILON || Math.abs(segment.b.x + halfWidth) > EPSILON || segment.nx < 0.99) return [];
        a = halfDepth - segment.a.z; b = halfDepth - segment.b.z; break;
    }
    return [{ start: Math.min(a, b), end: Math.max(a, b) }];
  });
}

export function validateOpening(room: RoomShape, opening: RoomOpening, openings: RoomOpening[] = room.openings ?? []): string | null {
  const shapeProblem = validateRoomShape(room);
  if (shapeProblem) return shapeProblem;
  const problem = openingError(opening);
  if (problem) return problem;
  const bounds = spans(room, opening);
  if (bounds.left < -EPSILON || bounds.right > wallLength(room, opening.wallId) + EPSILON) return "Хаалга, цонх хүрээний хамт ханандаа багтах ёстой.";
  if (bounds.top > (room.height ?? 2.7) + EPSILON) return "Хаалга, цонхны дээд хүрээ таазнаас өндөр байна.";
  if (!availableWallSpans(room, opening.wallId).some(span => bounds.left >= span.start - EPSILON && bounds.right <= span.end + EPSILON)) return "Энэ хэсэгт ханын товойлт, хонхор эсвэл багана байна. Өөр хэсэгт байрлуулна уу.";
  for (const other of openings) {
    if (other.id === opening.id) continue;
    const otherProblem = openingError(other);
    if (otherProblem) return otherProblem;
    if (other.wallId !== opening.wallId) continue;
    const otherBounds = spans(room, other);
    if (Math.min(bounds.right, otherBounds.right) - Math.max(bounds.left, otherBounds.left) > EPSILON &&
      Math.min(bounds.top, otherBounds.top) - Math.max(bounds.bottom, otherBounds.bottom) > EPSILON) return "Хаалга, цонхны хүрээнүүд давхцаж байна. Байрлалыг зайлуулна уу.";
  }
  return null;
}

/** Call before changing width, depth, ceiling height, columns, or wall features. */
export function validateRoomOpenings(room: RoomShape): string | null {
  const shapeProblem = validateRoomShape(room);
  if (shapeProblem) return shapeProblem;
  const ids = new Set<string>();
  for (const opening of room.openings ?? []) {
    if (!opening || ids.has(opening.id)) return "Хаалга, цонхны дугаар давхцаж байна.";
    ids.add(opening.id);
    const problem = validateOpening(room, opening);
    if (problem) return problem;
  }
  return null;
}
