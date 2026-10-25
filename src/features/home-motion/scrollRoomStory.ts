export type RoomPoint = [number, number, number];
export type RoomFurniture = "sofa" | "bed" | "wardrobe";
export type RoomMotion = {
  progress: number;
  visible: boolean;
  paused: boolean;
  snap: boolean;
  invalidate?: () => void;
};
export const ROOM_STEPS = [0.2, 0.44, 0.72, 1] as const;
export const ROOM_LABELS = ["Буйдан", "Өрөө хооронд", "Ор", "Шкаф"] as const;
const clamp = (p: number) =>
  Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));
const ease = (p: number) => {
  const t = clamp(p);
  return t * t * (3 - 2 * t);
};
const mix = (a: RoomPoint, b: RoomPoint, t: number): RoomPoint =>
  a.map((v, i) => v + (b[i] - v) * t) as RoomPoint;
// Partition z=-3.5 has a door x=1.5..3. Stay centered until through the doorway.
const frames: { at: number; eye: RoomPoint; target: RoomPoint }[] = [
  { at: 0, eye: [1.9, 1.55, 3.2], target: [-0.65, 0.85, -1.65] },
  { at: 0.2, eye: [0.9, 1.18, -0.05], target: [-0.35, 0.68, -1.65] },
  { at: 0.27, eye: [1.35, 1.32, -0.15], target: [-0.55, 0.8, -1.65] },
  { at: 0.36, eye: [2.25, 1.55, -0.85], target: [2.25, 1.45, -7] },
  { at: 0.49, eye: [2.25, 1.55, -4.3], target: [1.25, 1.2, -8.8] },
  { at: 0.58, eye: [0.6, 1.5, -6.35], target: [-0.65, 1.1, -9.35] },
  { at: 0.73, eye: [0.3, 1.38, -6.5], target: [-0.65, 0.65, -9.35] },
  { at: 0.85, eye: [-0.65, 1.48, -5.75], target: [3.27, 1.45, -8.1] },
  { at: 1, eye: [-0.5, 1.42, -6.25], target: [3.27, 1.2, -8.1] },
];
/** Camera and furniture are pure scroll poses, with no elapsed-time autoplay. */
export function scrollRoomPose(progress: number) {
  const p = clamp(progress);
  const end = frames.findIndex((frame, index) => index > 0 && p <= frame.at);
  const b = frames[end < 0 ? frames.length - 1 : end],
    a = frames[Math.max(0, (end < 0 ? frames.length - 1 : end) - 1)];
  const t = ease((p - a.at) / (b.at - a.at));
  return {
    eye: mix(a.eye, b.eye, t),
    target: mix(a.target, b.target, t),
    sofaY: 0.055,
    bedY: 0.055 + 2.8 * (1 - ease((p - 0.57) / 0.15)),
    wardrobeY: 0.02 + 2.8 * (1 - ease((p - 0.85) / 0.13)),
    bedVisible: p >= 0.53,
    wardrobeVisible: p >= 0.82,
    phase: p < 0.3 ? 0 : p < 0.54 ? 1 : p < 0.79 ? 2 : 3,
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
