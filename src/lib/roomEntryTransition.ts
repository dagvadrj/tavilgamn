import { Euler, MathUtils, Quaternion, Vector3, type PerspectiveCamera } from "three";
import type { RoomInteriorCamera } from "./types";
import { clampTourFov, tourVerticalFov } from "./roomInteriorCamera";

/** Wheel distance, in CSS pixels, from the exterior threshold to standing inside. */
export const ROOM_ENTRY = {
  pixels: 520,
  smoothingSeconds: 0.12,
  /** Trackpad noise and inertia tails below this are not intentional input. */
  deadZone: 0.35,
  /** Inertia that continues after a commit must not immediately reverse it. */
  reversalCooldownMs: 180,
  entryPitch: -0.12,
} as const;

export type WheelInput = { deltaY: number; deltaMode: number };

/** Normalise line/page wheels and trackpad pixels to one clamped pixel scale. */
export function wheelPixels(event: WheelInput, pageHeight: number) {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, pageHeight) : 1;
  const pixels = event.deltaY * scale;
  return Number.isFinite(pixels) ? MathUtils.clamp(pixels, -600, 600) : 0;
}

/** progress 0 is the exterior pose, 1 is the interior pose; target follows the wheel. */
export interface EntryProgress { progress: number; target: number }

/** Negative deltaY scrolls in. The target never leaves [0, 1]. */
export function feedEntry(state: EntryProgress, pixels: number): EntryProgress {
  const target = MathUtils.clamp(state.target - pixels / ROOM_ENTRY.pixels, 0, 1);
  // Many small trackpad deltas accumulate rounding; the ends must be exact to commit.
  return { ...state, target: target < 1e-6 ? 0 : target > 1 - 1e-6 ? 1 : target };
}

/** Time-based damping: equal progress at equal time on 30/60/120 Hz displays. */
export function advanceEntry(state: EntryProgress, delta: number, reducedMotion = false): EntryProgress {
  if (reducedMotion) return { ...state, progress: state.target };
  const step = Number.isFinite(delta) ? MathUtils.clamp(delta, 0, 0.1) : 0;
  const alpha = -Math.expm1(-step / ROOM_ENTRY.smoothingSeconds);
  const progress = state.progress + (state.target - state.progress) * alpha;
  // 0.2 % of the walk is millimetres: snap there instead of a long invisible tail.
  return { ...state, progress: Math.abs(state.target - progress) < 2e-3 ? state.target : progress };
}

export const entrySettled = (state: EntryProgress) => state.progress === state.target;

/** Ease in and out so the hand-over at both ends has no velocity step. */
export function entryEase(t: number) {
  const x = MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export interface EntryPose { position: Vector3; quaternion: Quaternion; fov: number }

export function cameraEntryPose(camera: PerspectiveCamera): EntryPose {
  camera.updateMatrixWorld();
  return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
}

/** Exactly the pose RoomStreetView applies, so the hand-over cannot move the image. */
export function interiorEntryPose(pose: RoomInteriorCamera, aspect: number): EntryPose {
  const quaternion = new Quaternion().setFromEuler(new Euler(pose.pitch, pose.yaw, 0, "YXZ"));
  return { position: new Vector3(pose.x, pose.eyeHeight, pose.z), quaternion, fov: tourVerticalFov(clampTourFov(pose.fov), aspect) };
}

/** Interior heading that continues the exterior view direction instead of spinning. */
export function entryYaw(position: Vector3, target: Vector3, fallback: number) {
  const dx = target.x - position.x, dz = target.z - position.z;
  return dx * dx + dz * dz < 1e-8 ? fallback : Math.atan2(-dx, -dz);
}

export function writeEntryPose(camera: PerspectiveCamera, exterior: EntryPose, interior: EntryPose, progress: number) {
  const t = entryEase(progress);
  // Exact endpoints: the controller hands over to a pose written independently.
  if (t === 0 || t === 1) {
    const end = t === 0 ? exterior : interior;
    camera.position.copy(end.position);
    camera.quaternion.copy(end.quaternion);
  } else {
    camera.position.lerpVectors(exterior.position, interior.position, t);
    camera.quaternion.slerpQuaternions(exterior.quaternion, interior.quaternion, t);
  }
  camera.up.set(0, 1, 0);
  const fov = exterior.fov + (interior.fov - exterior.fov) * t;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

/** Closest orbit distance before more scroll-in becomes walking into the active room. */
export function roomEntryDistance(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return MathUtils.clamp(Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.6, 2.5, 9);
}

/** Only the room the orbit target is over may be entered. */
export function entryTargetOverRoom(target: Vector3, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, margin = 1) {
  return target.x >= bounds.minX - margin && target.x <= bounds.maxX + margin &&
    target.z >= bounds.minZ - margin && target.z <= bounds.maxZ + margin;
}

/**
 * A readable overview when leaving a room that was entered without a remembered
 * exterior pose: look the same way as inside, from outside the entry threshold.
 */
export function exteriorOverview(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, height: number,
  yaw: number, fov: number, aspect: number) {
  const target = new Vector3((bounds.minX + bounds.maxX) / 2, height * 0.4, (bounds.minZ + bounds.maxZ) / 2);
  const halfFov = MathUtils.degToRad(fov / 2), horizontal = Math.atan(Math.tan(halfFov) * Math.max(0.1, aspect));
  const radius = Math.hypot((bounds.maxX - bounds.minX) / 2, (bounds.maxZ - bounds.minZ) / 2, height * 0.6);
  const distance = Math.max(radius / Math.sin(Math.min(halfFov, horizontal)) * 1.08, roomEntryDistance(bounds) * 1.2);
  const elevation = MathUtils.degToRad(38);
  const back = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(Math.cos(elevation));
  back.y = Math.sin(elevation);
  const position = target.clone().addScaledVector(back.normalize(), distance);
  return { position, target, up: new Vector3(0, 1, 0), fov, far: Math.max(300, distance * 4), zoom: 1 };
}
