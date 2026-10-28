export type RoomPoint = [number, number, number];
export type RoomFurniture =
  | "sofa"
  | "chair"
  | "table"
  | "bed"
  | "nightstand"
  | "wardrobe"
  | "desk"
  | "officeChair"
  | "bookshelf";
export type RoomMotion = {
  progress: number;
  visible: boolean;
  paused: boolean;
  snap: boolean;
  invalidate?: () => void;
};
export const ROOM_STEPS = [0, 0.5, 1] as const;
export const ROOM_LABELS = [
  "Зочны өрөө",
  "Унтлагын өрөө",
  "Ажлын өрөө",
] as const;
export const ROOM_GAP = 14;
const FOCUS: Record<RoomFurniture, { eye: RoomPoint; target: RoomPoint }> = {
  sofa: { eye: [-0.2, 1.35, 0.8], target: [1.8, 0.72, -2.1] },
  chair: { eye: [0.4, 1.2, 1], target: [-1.2, 0.65, -1] },
  table: { eye: [-0.6, 1.5, 2.5], target: [1, 0.45, 0.6] },
  bed: { eye: [-1.6, 1.6, 1.6], target: [0.9, 0.8, -2.1] },
  nightstand: { eye: [-0.3, 1.1, -1.8], target: [-1.45, 0.6, -3.9] },
  wardrobe: { eye: [0.7, 1.7, -0.8], target: [4, 1.6, -2.6] },
  desk: { eye: [-1.8, 1.5, 1.3], target: [0.5, 0.85, -1.5] },
  officeChair: { eye: [-0.1, 1.4, 2.1], target: [1.7, 0.9, 0.15] },
  bookshelf: { eye: [0.7, 1.9, -0.3], target: [2.5, 1.9, -4.3] },
};
export function roomFocusPose(
  item: RoomFurniture,
  rotation = 0,
  compact = false,
) {
  const offset = ROOM_ITEMS[item].room * ROOM_GAP;
  const world = ([x, y, z]: RoomPoint): RoomPoint => [
    offset + x * Math.cos(rotation) + z * Math.sin(rotation),
    y,
    -x * Math.sin(rotation) + z * Math.cos(rotation),
  ];
  const focus = FOCUS[item];
  const eye = compact
    ? (focus.eye.map(
        (value, i) => focus.target[i] + (value - focus.target[i]) * 1.55,
      ) as RoomPoint)
    : focus.eye;
  return { eye: world(eye), target: world(focus.target) };
}
export const ROOM_ITEMS: Record<
  RoomFurniture,
  {
    label: string;
    room: number;
    finish: "fabric" | "wood" | "leather";
    category: string;
  }
> = {
  sofa: { label: "Буйдан", room: 0, finish: "fabric", category: "sofa" },
  chair: {
    label: "Зөөлөн сандал",
    room: 0,
    finish: "leather",
    category: "sofa",
  },
  table: { label: "Кофены ширээ", room: 0, finish: "wood", category: "table" },
  bed: { label: "Ор", room: 1, finish: "fabric", category: "bed" },
  nightstand: {
    label: "Орны шүүгээ",
    room: 1,
    finish: "wood",
    category: "bed",
  },
  wardrobe: { label: "Шкаф", room: 1, finish: "wood", category: "wardrobe" },
  desk: { label: "Ажлын ширээ", room: 2, finish: "wood", category: "office" },
  officeChair: {
    label: "Ажлын сандал",
    room: 2,
    finish: "fabric",
    category: "office",
  },
  bookshelf: {
    label: "Номын тавиур",
    room: 2,
    finish: "wood",
    category: "shelf",
  },
};
export const ROOM_FINISHES = {
  fabric: [
    { name: "Байгалийн", color: "#e6ded0" },
    { name: "Элсэн", color: "#b8a78e" },
    { name: "Чидун", color: "#72765d" },
    { name: "Нүүрсэн", color: "#4b4c4b" },
  ],
  wood: [
    { name: "Хушга", color: "#69503a" },
    { name: "Царс", color: "#b29168" },
    { name: "Үнсэн", color: "#c6b69c" },
    { name: "Бараан", color: "#36302a" },
  ],
  leather: [
    { name: "Коньяк", color: "#b48152" },
    { name: "Шоколад", color: "#765339" },
    { name: "Нүүрсэн", color: "#393632" },
    { name: "Элсэн", color: "#cbb89a" },
  ],
};
const clamp = (p: number) =>
  Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
const smooth = (start: number, end: number, p: number) => {
  const t = clamp((p - start) / (end - start));
  return t * t * (3 - 2 * t);
};
/** Three separate, rotating room stages, following the supplied prototype. */
export function scrollRoomPose(progress: number, compact = false) {
  const p = clamp(progress);
  const travel = smooth(0.2, 0.4, p) + smooth(0.68, 0.88, p);
  const phase = Math.round(travel);
  const detail = 0.65 * smooth(0, 0.17, p) * (1 - smooth(0.18, 0.27, p));
  const x = travel * ROOM_GAP;
  if (compact) {
    // Portrait cameras frame the main furniture inside each room. The renderer
    // reframes with a short fade instead of passing through a side wall/window.
    const offset = phase * ROOM_GAP;
    const center = phase === 0 ? 1.65 : phase === 1 ? 0.95 : 0.65;
    return {
      travel,
      phase,
      eye: [
        offset + center + (travel - phase) * 0.25,
        2,
        4.6 - detail * 0.35,
      ] as RoomPoint,
      target: [offset + center, 0.85, -1.65] as RoomPoint,
      rotations: [0, 1, 2].map((i) =>
        Math.max(-0.06, Math.min(0.06, (i - travel) * 0.12)),
      ),
      settled: p >= 0.98,
    };
  }
  return {
    travel,
    phase,
    eye: [x + 0.25, 1.85, 4.7 - detail] as RoomPoint,
    target: [x + 0.15, 1.25, -2] as RoomPoint,
    rotations: [0, 1, 2].map((i) =>
      Math.max(-0.58, Math.min(0.58, (i - travel) * 0.5)),
    ),
    settled: p >= 0.98,
  };
}
export function roomScrollProgress(
  top: number,
  height: number,
  stageHeight: number,
  header: number,
) {
  return clamp((header - top) / Math.max(1, height - stageHeight));
}
