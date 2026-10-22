export const HOME_PRODUCT_IDS = [
  "2b9cdc29-650f-4574-83ee-c3b6092d6ef8",
  "0f05288c-7957-4c08-8c1b-d7e1e650c712",
] as const;

export const INTERIOR_STYLES = [
  {
    id: "scandi",
    name: "Скандинав",
    note: "Гэрэл, мод, тайван орон зай.",
    wall: "#ece5da",
    floor: "#f7f1e7",
    rug: "#b8ad99",
    sofa: "#e7dfce",
    accent: "#707b61",
    product: 0,
  },
  {
    id: "modern",
    name: "Модерн",
    note: "Тод хэлбэр. Цэгцтэй хэмнэл.",
    wall: "#d8d6cf",
    floor: "#e1d7c8",
    rug: "#727770",
    sofa: "#a4a79a",
    accent: "#414b43",
    product: 1,
  },
  {
    id: "warm",
    name: "Дулаан",
    note: "Байгалийн өнгө, тухтай мэдрэмж.",
    wall: "#e4d6c3",
    floor: "#f1dfc6",
    rug: "#ba886c",
    sofa: "#c99066",
    accent: "#8b563d",
    product: 0,
  },
  {
    id: "minimal",
    name: "Минимал",
    note: "Цөөн зүйл. Илүү их амгалан.",
    wall: "#eeeae2",
    floor: "#e9e4da",
    rug: "#ddd9d0",
    sofa: "#d9d4c8",
    accent: "#737870",
    product: 1,
  },
] as const;
export type InteriorStyle = (typeof INTERIOR_STYLES)[number];
export const SOFA_GROUND_Y = 0.055;
export const STORY_SCROLL_SCREENS = 4.8;
export const JOURNEY_PLACEMENTS = {
  sofa: {
    position: [-0.65, SOFA_GROUND_Y, -1.65],
    rotation: 0,
    size: [2.9, 1.5, 1.5],
  },
  bed: { position: [-0.65, 0.055, -9.35], rotation: 0, size: [2.2, 1.4, 2.6] },
  wardrobe: {
    position: [3.27, 0.02, -8.1],
    rotation: -Math.PI / 2,
    size: [2.5, 2.45, 0.7],
  },
} as const;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};

const CAMERA_KEYS = [
  { p: 0, eye: [1.9, 1.55, 3.2], target: [-0.65, 1.05, -1.65] },
  { p: 0.2, eye: [1.2, 1.45, 2.55], target: [-0.65, 0.75, -1.65] },
  { p: 0.3, eye: [2.25, 1.55, -0.85], target: [2.25, 1.45, -7] },
  { p: 0.43, eye: [2.25, 1.55, -4.15], target: [1.8, 1.2, -8] },
  { p: 0.55, eye: [0.8, 1.45, -6.5], target: [-0.65, 0.95, -9.35] },
  { p: 0.7, eye: [0.65, 1.4, -6.75], target: [-0.65, 0.65, -9.35] },
  { p: 0.86, eye: [0.4, 1.45, -6.1], target: [3.27, 1.25, -8.1] },
  { p: 1, eye: [0.4, 1.45, -6.1], target: [3.27, 1.15, -8.1] },
];
const tuple = (a: number[], b: number[], t: number) =>
  a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

/** One floor, a real doorway, independent furniture. Pure poses also replay backwards. */
export function storyPose(progress: number, _seconds = 0, reduced = false) {
  const p = reduced ? 1 : clamp01(progress);
  const end = CAMERA_KEYS.findIndex((key) => key.p >= p);
  const b = CAMERA_KEYS[Math.max(1, end)],
    a = CAMERA_KEYS[Math.max(1, end) - 1];
  const t = smooth((p - a.p) / (b.p - a.p));
  return {
    eye: tuple(a.eye, b.eye, t),
    target: tuple(a.target, b.target, t),
    sofaY: SOFA_GROUND_Y + 1.15 * (1 - smooth((p - 0.035) / 0.14)),
    bedY:
      JOURNEY_PLACEMENTS.bed.position[1] +
      0.85 * (1 - smooth((p - 0.48) / 0.17)),
    wardrobeY:
      JOURNEY_PLACEMENTS.wardrobe.position[1] +
      0.3 * (1 - smooth((p - 0.84) / 0.12)),
    wardrobeVisible: p >= 0.8,
    phase: p < 0.22 ? 0 : p < 0.47 ? 1 : p < 0.73 ? 2 : 3,
    landed: p >= 1,
  };
}

/** A gentle, finite replacement lift; no accumulating rotations or perpetual bounce. */
export function replacementHeight(progress: number) {
  if (progress < 0 || progress >= 1) return 0;
  if (progress < 0.45) return 5 * smooth(progress / 0.45);
  if (progress < 0.55) return 5;
  const t = clamp01((progress - 0.55) / 0.35);
  const bounce = clamp01((progress - 0.9) / 0.1);
  return 5 * (1 - smooth(t)) + Math.sin(bounce * Math.PI) ** 2 * 0.035;
}

export type StoryMotion = {
  progress: number;
  paused?: boolean;
  snap?: boolean;
  pointer: { x: number; y: number };
  swap: number;
  visible: boolean;
  invalidate?: () => void;
};
