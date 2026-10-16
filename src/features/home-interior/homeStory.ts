export const HOME_PRODUCT_IDS = [
  "2b9cdc29-650f-4574-83ee-c3b6092d6ef8",
  "0f05288c-7957-4c08-8c1b-d7e1e650c712",
] as const;

export const INTERIOR_STYLES = [
  {
    id: "scandi",
    name: "Скандинав",
    note: "Гэрэл, мод, тайван орон зай.",
    wall: "#e8e5db",
    floor: "#c5aa83",
    rug: "#c5c7b6",
    sofa: "#e7dfce",
    accent: "#707b61",
    product: 0,
  },
  {
    id: "modern",
    name: "Модерн",
    note: "Тод хэлбэр. Цэгцтэй хэмнэл.",
    wall: "#d3d3ce",
    floor: "#9c9387",
    rug: "#727770",
    sofa: "#a4a79a",
    accent: "#414b43",
    product: 1,
  },
  {
    id: "warm",
    name: "Дулаан",
    note: "Байгалийн өнгө, тухтай мэдрэмж.",
    wall: "#e5d4bd",
    floor: "#b28a60",
    rug: "#ba886c",
    sofa: "#c99066",
    accent: "#8b563d",
    product: 0,
  },
  {
    id: "minimal",
    name: "Минимал",
    note: "Цөөн зүйл. Илүү их амгалан.",
    wall: "#f1eee6",
    floor: "#d7cebd",
    rug: "#ddd9d0",
    sofa: "#d9d4c8",
    accent: "#737870",
    product: 1,
  },
] as const;
export type InteriorStyle = (typeof INTERIOR_STYLES)[number];
export const LOWER_ROOM_Y = -7.2;
export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
export const smooth = (n: number) => {
  const t = clamp01(n);
  return t * t * (3 - 2 * t);
};

/** Absolute poses make a fast scroll or restored scroll position deterministic. */
export function storyPose(progress: number, seconds = 0, reduced = false) {
  const p = reduced ? 1 : clamp01(progress);
  const travel = smooth((p - 0.3) / 0.32);
  const drop = clamp01((p - 0.62) / 0.25);
  const landing = clamp01((p - 0.87) / 0.13);
  const bob = Math.sin(seconds * 1.5) * 0.055 * (1 - smooth(p / 0.3));
  const sofaY =
    p < 0.62
      ? 1.1 + bob
      : LOWER_ROOM_Y +
        0.055 +
        (1 - smooth(drop)) * 4.6 +
        (landing > 0 && landing < 1
          ? Math.sin(landing * Math.PI) ** 2 * 0.045
          : 0);
  return {
    cameraY: LOWER_ROOM_Y * travel,
    sofaY: p >= 1 ? LOWER_ROOM_Y + 0.055 : sofaY,
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
