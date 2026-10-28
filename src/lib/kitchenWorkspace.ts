import type { KitchenRoom, KitchenSpaceItem } from "./kitchenCabinets";
import type { BomRow, KitchenBom } from "./kitchenBom";

/**
 * K workflow rules shared by the panel, the plan and the handoff: wall
 * letters, the brief's room limits, unit display, BOM presentation and the
 * measurement form. Pure, so the rules are tested without the 3D editor.
 */

export type KitchenWallSide = KitchenSpaceItem["wall"];
export type KitchenWallLetter = "A" | "B" | "C" | "D";
export type KitchenUnit = "mm" | "cm";

/** A and C run along the width, B and D along the depth (clockwise from A). */
export const KITCHEN_WALLS: readonly {
  letter: KitchenWallLetter;
  side: KitchenWallSide;
  axis: "width" | "depth";
}[] = [
  { letter: "A", side: "back", axis: "width" },
  { letter: "B", side: "right", axis: "depth" },
  { letter: "C", side: "front", axis: "width" },
  { letter: "D", side: "left", axis: "depth" },
];

export const wallLetter = (side: KitchenWallSide): KitchenWallLetter =>
  KITCHEN_WALLS.find((wall) => wall.side === side)!.letter;

export const wallLength = (room: Pick<KitchenRoom, "width" | "depth">, side: KitchenWallSide) =>
  side === "back" || side === "front" ? room.width : room.depth;

export const KITCHEN_ROOM_LIMITS = {
  width: [1800, 8000],
  depth: [1500, 8000],
  height: [2200, 3500],
  window: [400, 3000],
  door: [600, 1200],
  /** Clear wall left beyond an opening. */
  openingMargin: 100,
} as const;

export const WALL_THICKNESS_MM = 150;

export type KitchenRoomField = "width" | "depth" | "height";
export interface KitchenRoomIssues {
  fields: Partial<Record<KitchenRoomField, string>>;
  openings: Record<string, string>;
}

/** Display value in the chosen unit; mm stays whole, cm keeps one decimal. */
export function toUnit(mm: number, unit: KitchenUnit) {
  return unit === "mm" ? String(Math.round(mm)) : String(Math.round(mm) / 10);
}

/** Parse a typed value back to mm; null when it is not a number. */
export function fromUnit(text: string, unit: KitchenUnit): number | null {
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  if (!text.trim() || !Number.isFinite(value)) return null;
  return Math.round(unit === "mm" ? value : value * 10);
}

const range = (label: string, value: number, [min, max]: readonly [number, number], unit: KitchenUnit) =>
  value < min || value > max
    ? `${label} ${toUnit(min, unit)}–${toUnit(max, unit)} ${unit} байна.`
    : undefined;

/** Distance from the wall's start (clockwise) to the opening's near edge. */
export function openingOffset(room: Pick<KitchenRoom, "width" | "depth">, item: KitchenSpaceItem) {
  const centre = item.wall === "back" || item.wall === "front" ? item.x : item.z;
  return Math.round(centre - item.width / 2);
}

/** The brief's K1 rules; an empty result means steps 2–4 may open. */
export function kitchenRoomIssues(room: KitchenRoom, unit: KitchenUnit = "mm"): KitchenRoomIssues {
  const fields: KitchenRoomIssues["fields"] = {};
  const width = range("Өргөн", room.width, KITCHEN_ROOM_LIMITS.width, unit);
  const depth = range("Гүн", room.depth, KITCHEN_ROOM_LIMITS.depth, unit);
  const height = range("Таазны өндөр", room.height, KITCHEN_ROOM_LIMITS.height, unit);
  if (width) fields.width = width;
  if (depth) fields.depth = depth;
  if (height) fields.height = height;
  const openings: Record<string, string> = {};
  for (const item of room.items ?? []) {
    if (item.kind !== "door" && item.kind !== "window") continue;
    const label = item.kind === "door" ? "Хаалганы өргөн" : "Цонхны өргөн";
    const size = range(label, item.width, KITCHEN_ROOM_LIMITS[item.kind], unit);
    if (size) {
      openings[item.id] = size;
      continue;
    }
    const length = wallLength(room, item.wall);
    const offset = openingOffset(room, item);
    if (offset < 0 || offset + item.width > length - KITCHEN_ROOM_LIMITS.openingMargin)
      openings[item.id] =
        `Байрлал + өргөн ${toUnit(length - KITCHEN_ROOM_LIMITS.openingMargin, unit)} ${unit}-ээс хэтэрч байна (${wallLetter(item.wall)} хана).`;
  }
  return { fields, openings };
}

export const roomIssueCount = (issues: KitchenRoomIssues) =>
  Object.keys(issues.fields).length + Object.keys(issues.openings).length;

/** Toast text for a locked step 2–4, or null when the room is valid. */
export function kitchenStepLock(room: KitchenRoom) {
  const count = roomIssueCount(kitchenRoomIssues(room));
  return count
    ? `Өрөөний ${count} алдааг засаад дараагийн алхам руу орно.`
    : null;
}

/** «Гал тогоо · 4.5 × 3.6 м» for the header. */
export function kitchenProjectTitle(room: Pick<KitchenRoom, "width" | "depth">) {
  const metres = (mm: number) => (Math.round(mm / 100) / 10).toString();
  return `Гал тогоо · ${metres(room.width)} × ${metres(room.depth)} м`;
}

export type BomSource = "actual" | "sample" | "computed" | "included";
export interface BomPresentationRow extends BomRow {
  kind: string;
  source: BomSource;
  /** Null when the row has no known price; 0 only for a real zero. */
  total: number | null;
}

/** Rows sized from the room by kitchenBom (tops, splash and filler panels). */
const COMPUTED = /^(Тавцан|Ханын хавтан|Булангийн зайны хавтан)/;

/**
 * K6 rows: included parts are shown but never priced, rows without a
 * catalog product are Sample, sized-from-room rows are computed.
 */
export function presentKitchenBom(bom: KitchenBom): {
  rows: BomPresentationRow[];
  knownTotal: number;
  unpriced: BomPresentationRow[];
  includedCount: number;
} {
  const rows = bom.items.map((row): BomPresentationRow => {
    const source: BomSource = row.included
      ? "included"
      : COMPUTED.test(row.label)
        ? "computed"
        : row.productId
          ? "actual"
          : "sample";
    const kind = row.included
      ? "Багтсан"
      : /equipment|appliance/.test(row.id)
        ? "Тоног"
        : COMPUTED.test(row.label)
          ? "Тавцан, хавтан"
          : "Модуль";
    const total =
      row.included || row.unitPrice === null ? null : row.unitPrice * row.quantity;
    return { ...row, kind, source, total };
  });
  const billable = rows.filter((row) => !row.included);
  return {
    rows,
    knownTotal: billable.reduce((sum, row) => sum + (row.total ?? 0), 0),
    unpriced: billable.filter((row) => row.unitPrice === null),
    includedCount: rows.length - billable.length,
  };
}

export const BOM_SOURCE_LABEL: Record<BomSource, string> = {
  actual: "Actual",
  sample: "Sample",
  computed: "Тооцоолсон",
  included: "Багтсан",
};

/** Price text that never says «Үнэгүй»: null is unknown, 0 is a real zero. */
export function bomMoney(value: number | null) {
  return value === null ? "Үнэ бүртгэгдээгүй" : `₮${value.toLocaleString("en-US")}`;
}

export interface MeasureForm {
  name: string;
  phone: string;
  district: string;
  slot: string;
  consent: boolean;
}

export const MEASURE_DISTRICTS = [
  "Баянгол",
  "Баянзүрх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
] as const;

export const MEASURE_SLOTS = ["Өглөө", "Өдөр", "Орой"] as const;

export function measureFormErrors(form: MeasureForm) {
  const errors: Partial<Record<keyof MeasureForm, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Нэрээ оруулна уу.";
  if (!/^\d{8}$/.test(form.phone.replace(/\s/g, "")))
    errors.phone = "Утасны дугаар 8 оронтой байна.";
  if (!form.district) errors.district = "Дүүргээ сонгоно уу.";
  if (!form.consent) errors.consent = "Зөвшөөрөл шаардлагатай.";
  return errors;
}

/** K7 warnings drawn only from the design itself, never invented. */
export function handoffWarnings(input: {
  room: KitchenRoom;
  cabinets: { id: string; type: string; opening?: string; catalogAdaptation?: string }[];
  unpricedCount: number;
}) {
  const warnings: string[] = [];
  const items = input.room.items ?? [];
  if (input.cabinets.some((cabinet) => cabinet.type !== "wall"))
    warnings.push("Тавцангийн урт, хэлбэрийг хэмжилтээр батална.");
  if (items.some((item) => item.kind === "window"))
    warnings.push("Цонх нээгдэхэд холигч, дээд шүүгээтэй мөргөлдөх эсэхийг газар дээр нь шалгана.");
  if (items.some((item) => item.kind === "vent") || input.cabinets.some((cabinet) => cabinet.opening === "hood"))
    warnings.push("Агааржуулалтын хоолойн урт, чиглэлийг хэмжигч тодруулна.");
  if (input.cabinets.some((cabinet) => cabinet.catalogAdaptation === "sink") && !items.some((item) => item.kind === "water"))
    warnings.push("Угаалтуур байгаа ч ус/бохирын цэг тэмдэглэгдээгүй.");
  if (input.unpricedCount)
    warnings.push(`${input.unpricedCount} мөрийн үнэ тодорхойгүй — урьдчилсан дүнд ороогүй.`);
  return warnings;
}

type ElevationCabinet = {
  id: string;
  type: string;
  width: number;
  depth: number;
  height: number;
  position: { x: number; y: number; z: number; rotation: number };
};

/**
 * K5 wall elevation: pieces standing within `reach` of a wall, measured along
 * it as seen from inside the room (left to right). Free-standing pieces
 * (tables) belong to no wall and are left out rather than projected.
 */
export function wallElevation(
  room: Pick<KitchenRoom, "width" | "depth" | "items">,
  cabinets: ElevationCabinet[],
  side: KitchenWallSide,
  reach = 120,
) {
  const length = wallLength(room, side);
  const pieces = cabinets.flatMap((cabinet) => {
    const sin = Math.sin(cabinet.position.rotation);
    const cos = Math.cos(cabinet.position.rotation);
    const xs = [-1, 1].flatMap((a) => [-1, 1].map((b) => cabinet.position.x + (a * cos * cabinet.width) / 2 + (b * sin * cabinet.depth) / 2));
    const zs = [-1, 1].flatMap((a) => [-1, 1].map((b) => cabinet.position.z - (a * sin * cabinet.width) / 2 + (b * cos * cabinet.depth) / 2));
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const gap = { back: minZ, front: room.depth - maxZ, left: minX, right: room.width - maxX }[side];
    if (gap > reach) return [];
    // Seen from inside: A left→right is +x, B is +z, C is −x, D is −z.
    const [start, end] =
      side === "back" ? [minX, maxX]
      : side === "right" ? [minZ, maxZ]
      : side === "front" ? [room.width - maxX, room.width - minX]
      : [room.depth - maxZ, room.depth - minZ];
    return [{ id: cabinet.id, type: cabinet.type, start: Math.round(start), end: Math.round(end), bottom: Math.round(cabinet.position.y), top: Math.round(cabinet.position.y + cabinet.height) }];
  });
  const openings = (room.items ?? [])
    .filter((item) => item.wall === side && (item.kind === "door" || item.kind === "window"))
    .map((item) => {
      const centre = side === "back" || side === "front" ? item.x : item.z;
      const along = side === "front" || side === "left" ? length - centre : centre;
      const bottom = item.kind === "door" ? 0 : item.sillHeight ?? 900;
      return { id: item.id, kind: item.kind, start: Math.round(along - item.width / 2), end: Math.round(along + item.width / 2), bottom, top: bottom + (item.height ?? (item.kind === "door" ? 2100 : 1100)) };
    });
  return { length, pieces: pieces.sort((a, b) => a.start - b.start), openings };
}
