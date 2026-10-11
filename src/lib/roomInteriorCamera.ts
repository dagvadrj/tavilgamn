import type { RoomInteriorCamera, RoomShape } from "./types";
import { getRoomGeometry } from "./roomGeometry";

export const DEFAULT_TOUR_FOV = 60;
export const MIN_TOUR_FOV = 35;
export const MAX_TOUR_FOV = 75;
export type WalkDirection = "forward" | "backward" | "left" | "right";

export function clampTourFov(fov = DEFAULT_TOUR_FOV) {
  return Number.isFinite(fov)
    ? Math.max(MIN_TOUR_FOV, Math.min(MAX_TOUR_FOV, fov))
    : DEFAULT_TOUR_FOV;
}

/** Keep the longer screen axis at the chosen angle, including wide desktop viewports. */
export function tourVerticalFov(fov: number, aspect: number) {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? Math.max(1, aspect) : 1;
  return (
    (2 *
      Math.atan(Math.tan((clampTourFov(fov) * Math.PI) / 360) / ratio) *
      180) /
    Math.PI
  );
}

export function cameraPointValid(
  room: RoomShape,
  x: number,
  z: number,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const geometry = getRoomGeometry(room);
  let inside = false;
  for (const loop of geometry.loops)
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i],
        b = loop[j];
      if (
        a.z > z !== b.z > z &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
      )
        inside = !inside;
    }
  return (
    inside &&
    geometry.segments.every(({ a, b }) => {
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
      );
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) >= 0.18;
    })
  );
}

export function interiorCamera(
  room: RoomShape,
  clear: (x: number, z: number) => boolean = () => true,
): RoomInteriorCamera {
  const saved = room.interiorCamera;
  const valid = (x: number, z: number) =>
    cameraPointValid(room, x, z) && clear(x, z);
  let point =
    saved && valid(saved.x, saved.z)
      ? { x: saved.x, z: saved.z }
      : { x: 0, z: 0 };
  if (!valid(point.x, point.z)) {
    const bounds = getRoomGeometry(room).bounds;
    const candidates: { x: number; z: number }[] = [];
    for (let x = bounds.minX + 0.2; x < bounds.maxX; x += 0.2)
      for (let z = bounds.minZ + 0.2; z < bounds.maxZ; z += 0.2)
        candidates.push({ x, z });
    candidates.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    point =
      candidates.find((p) => valid(p.x, p.z)) ??
      candidates.find((p) => cameraPointValid(room, p.x, p.z)) ??
      point;
  }
  return {
    ...point,
    fov: clampTourFov(saved?.fov),
    eyeHeight: Math.max(
      0.8,
      Math.min(
        (room.height ?? 2.7) - 0.3,
        Number.isFinite(saved?.eyeHeight) ? saved!.eyeHeight : 1.6,
      ),
    ),
    yaw: Number.isFinite(saved?.yaw) ? saved!.yaw : 0,
    pitch: Math.max(
      -1.35,
      Math.min(1.35, Number.isFinite(saved?.pitch) ? saved!.pitch : 0),
    ),
  };
}

/** Drag changes the viewing direction while the camera remains at its saved point. */
export function lookAround(
  pose: RoomInteriorCamera,
  dx: number,
  dy: number,
): RoomInteriorCamera {
  return {
    ...pose,
    yaw: pose.yaw - dx * 0.004,
    pitch: Math.max(-1.35, Math.min(1.35, pose.pitch - dy * 0.004)),
  };
}

/** Sweep in short steps and slide along obstructions, avoiding jumps through thin walls. */
export function walkCamera(
  pose: RoomInteriorCamera,
  forward: number,
  right: number,
  seconds: number,
  canStand: (x: number, z: number) => boolean,
): RoomInteriorCamera {
  if (!Number.isFinite(seconds) || seconds <= 0 || (!forward && !right))
    return pose;
  const magnitude = Math.hypot(forward, right);
  const distance = Math.min(0.1, seconds) * 1.2;
  const dx =
    ((-Math.sin(pose.yaw) * forward + Math.cos(pose.yaw) * right) / magnitude) *
    distance;
  const dz =
    ((-Math.cos(pose.yaw) * forward - Math.sin(pose.yaw) * right) / magnitude) *
    distance;
  const steps = Math.max(1, Math.ceil(distance / 0.04));
  let x = pose.x,
    z = pose.z;
  for (let i = 0; i < steps; i++) {
    const nx = x + dx / steps,
      nz = z + dz / steps;
    if (canStand(nx, nz)) {
      x = nx;
      z = nz;
    } else {
      if (canStand(nx, z)) x = nx;
      if (canStand(x, nz)) z = nz;
    }
  }
  return { ...pose, x, z };
}
