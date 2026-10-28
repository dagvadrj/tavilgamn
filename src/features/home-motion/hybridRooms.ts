import type { RoomFurniture, RoomPoint } from "./scrollRoomStory";

export type HybridFurnitureAnchor = {
  id: RoomFurniture;
  position: RoomPoint;
  yaw: number;
  size: RoomPoint;
  hotspot: RoomPoint;
};
export type HybridRoomDefinition = {
  id: string;
  image: string;
  frame: readonly [number, number];
  camera: { eye: RoomPoint; target: RoomPoint; fov: number };
  /** Normalized photo focal point. The exact same crop drives WebGL and DOM. */
  mobileFocus: number;
  furniture: readonly HybridFurnitureAnchor[];
  /** Foreground occluders, when present, share the backplate's crop. */
  masks: readonly string[];
};
export const HYBRID_ROOMS: readonly HybridRoomDefinition[] = [
  {
    id: "living",
    image: "/interior/hybrid/living.webp",
    frame: [1680, 944],
    camera: { eye: [0, 2.5, 7.8], target: [0, 1.35, -1], fov: 42 },
    mobileFocus: 0.67,
    masks: [],
    furniture: [
      {
        id: "sofa",
        position: [2.1, 0, 0.1],
        yaw: -0.13,
        size: [3.4, 1.3, 1.5],
        hotspot: [0, 0.85, 0.55],
      },
      {
        id: "chair",
        position: [-1.3, 0, 0.3],
        yaw: 0.4,
        size: [1.2, 1.3, 1.3],
        hotspot: [0, 0.8, 0.2],
      },
      {
        id: "table",
        position: [0.7, 0, 2.05],
        yaw: 0,
        size: [1.76, 0.74, 1.76],
        hotspot: [0, 0.65, 0],
      },
    ],
  },
  {
    id: "bedroom",
    image: "/interior/hybrid/bedroom.webp",
    frame: [1680, 944],
    camera: { eye: [0, 2.7, 8.8], target: [0, 1.8, -1], fov: 42 },
    mobileFocus: 0.62,
    masks: [],
    furniture: [
      {
        id: "bed",
        position: [1.3, 0, 0.3],
        yaw: -0.08,
        size: [3.2, 1.65, 3.9],
        hotspot: [0, 1.2, 0],
      },
      {
        id: "nightstand",
        position: [-1.05, 0, -1.35],
        yaw: 0,
        size: [0.85, 1.25, 0.66],
        hotspot: [0, 0.6, 0.4],
      },
      {
        id: "wardrobe",
        position: [4.6, 0, -1.65],
        yaw: -0.28,
        size: [2.65, 3.5, 0.7],
        hotspot: [0, 1.9, 0.45],
      },
    ],
  },
  {
    id: "office",
    image: "/interior/hybrid/office.webp",
    frame: [1680, 944],
    camera: { eye: [0, 2.6, 7.8], target: [0, 1.35, -1], fov: 42 },
    mobileFocus: 0.63,
    masks: [],
    furniture: [
      {
        id: "desk",
        position: [0.6, 0, 0.5],
        yaw: -0.12,
        size: [3.9, 1.35, 1.15],
        hotspot: [-0.8, 0.9, 0.5],
      },
      {
        id: "officeChair",
        position: [2.1, 0, 2.1],
        yaw: -0.35,
        size: [0.9, 1.65, 0.9],
        hotspot: [0, 1.1, 0.3],
      },
      {
        id: "bookshelf",
        position: [3.95, -0.4, -2.1],
        yaw: -0.14,
        size: [3, 3.6, 0.52],
        hotspot: [0.2, 2.3, 0.35],
      },
    ],
  },
];

export function hybridCrop(
  width: number,
  height: number,
  room: HybridRoomDefinition,
) {
  const [fw, fh] = room.frame;
  const scale = Math.max(width / fw, height / fh);
  const w = width / scale,
    h = height / scale;
  const focal = width / height < 1 ? room.mobileFocus : 0.5;
  const x = Math.max(0, Math.min(fw - w, fw * focal - w / 2));
  const y = Math.max(0, (fh - h) / 2);
  return { x, y, width: w, height: h, scale, fullWidth: fw, fullHeight: fh };
}

export function hybridZoom(progress: number, phase: number) {
  const start = [0, 0.4, 0.88][phase] ?? 0;
  const end = [0.2, 0.68, 1][phase] ?? 1;
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return 1 + 0.045 * t * t * (3 - 2 * t);
}
