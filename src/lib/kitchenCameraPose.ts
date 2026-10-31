/** Where the 3D camera stands and looks, in plan millimetres (x across, z into the room). */
export type KitchenCameraPose = { x: number; z: number; dirX: number; dirZ: number };

export type KitchenCameraPoseStore = {
  get: () => KitchenCameraPose | null;
  set: (pose: KitchenCameraPose) => void;
  subscribe: (listener: () => void) => () => void;
};

/** Smallest move worth redrawing the room map for: 20 mm or about one degree. */
const POSITION_STEP = 20;
const DIRECTION_STEP = 0.02;

/**
 * The camera moves every frame; only the room map reads it. A tiny store keeps
 * those updates out of the planner's own React state.
 */
export function createKitchenCameraPoseStore(): KitchenCameraPoseStore {
  let pose: KitchenCameraPose | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => pose,
    set(next) {
      if (
        pose &&
        Math.abs(next.x - pose.x) < POSITION_STEP &&
        Math.abs(next.z - pose.z) < POSITION_STEP &&
        Math.abs(next.dirX - pose.dirX) < DIRECTION_STEP &&
        Math.abs(next.dirZ - pose.dirZ) < DIRECTION_STEP
      )
        return;
      pose = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type KitchenMapSide = "front" | "back" | "left" | "right";

/**
 * Where to open the 3D view in a room without a window: in front of the
 * cabinets, weighted by width, so the longest run faces the camera and an L
 * opens on its corner. Turned slightly, as the window view is. Null when there
 * is nothing to face.
 */
export function kitchenFacingSide(cabinets: readonly { width: number; position: { rotation: number } }[]): [number, number] | null {
  let x = 0, z = 0;
  for (const cabinet of cabinets) {
    x += Math.sin(cabinet.position.rotation) * cabinet.width;
    z += Math.cos(cabinet.position.rotation) * cabinet.width;
  }
  const length = Math.hypot(x, z);
  if (length < 1e-6) return null;
  const turn = -0.6;
  const [sx, sz] = [x / length, z / length];
  return [sx * Math.cos(turn) - sz * Math.sin(turn), sx * Math.sin(turn) + sz * Math.cos(turn)];
}
