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
