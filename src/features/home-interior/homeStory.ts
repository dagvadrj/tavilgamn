export const HOME_PRODUCT_IDS = [
  "2b9cdc29-650f-4574-83ee-c3b6092d6ef8",
  "0f05288c-7957-4c08-8c1b-d7e1e650c712",
] as const;

export const INTERIOR_STYLES = [
  {
    id: "scandi",
    name: "Скандинав",
    note: "Гэрэл, мод, тайван орон зай.",
    wall: "#594536",
    floor: "#c69b7d",
    rug: "#b8ad99",
    sofa: "#e7dfce",
    accent: "#707b61",
    product: 0,
  },
  {
    id: "modern",
    name: "Модерн",
    note: "Тод хэлбэр. Цэгцтэй хэмнэл.",
    wall: "#4d4036",
    floor: "#af927d",
    rug: "#727770",
    sofa: "#a4a79a",
    accent: "#414b43",
    product: 1,
  },
  {
    id: "warm",
    name: "Дулаан",
    note: "Байгалийн өнгө, тухтай мэдрэмж.",
    wall: "#694b36",
    floor: "#c39370",
    rug: "#ba886c",
    sofa: "#c99066",
    accent: "#8b563d",
    product: 0,
  },
  {
    id: "minimal",
    name: "Минимал",
    note: "Цөөн зүйл. Илүү их амгалан.",
    wall: "#695a4c",
    floor: "#c7a88c",
    rug: "#ddd9d0",
    sofa: "#d9d4c8",
    accent: "#737870",
    product: 1,
  },
] as const;
export type InteriorStyle = (typeof INTERIOR_STYLES)[number];
export const LOWER_ROOM_Y = -7.2;
export const SOFA_GROUND_Y = 0.055;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};

/** Absolute poses make a fast scroll or restored scroll position deterministic. */
export function storyPose(progress: number, _seconds = 0, reduced = false) {
  const p = reduced ? 1 : clamp01(progress);
  const travel = smooth((p - 0.3) / 0.32);
  return {
    cameraY: LOWER_ROOM_Y * travel,
    sofaY: SOFA_GROUND_Y + LOWER_ROOM_Y * travel,
    rotation: Math.PI * 2 * smooth(p / 0.3),
    phase: p < 0.3 ? 0 : p < 0.62 ? 1 : p < 1 ? 2 : 3,
    landed: p >= 1,
  };
}

/** Lift old model out of sight, swap at the apex, drop the next model. */
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
  snap?: boolean;
  pointer: { x: number; y: number };
  swap: number;
  visible: boolean;
  invalidate?: () => void;
};
