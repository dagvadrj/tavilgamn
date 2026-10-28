import { Raycaster, Vector2, type Camera, type Object3D } from "three";

/** Name of the group that holds the active room's draggable furniture. */
export const PLANNER_FURNITURE_GROUP = "planner-furniture";

/**
 * Hand-over between the interior look controller and the wheel entry/exit
 * controller. Exactly one of them writes the camera at any moment.
 */
export interface InteriorEntryChannel {
  /** While true the entry controller owns the camera and RoomStreetView writes nothing. */
  suspended: boolean;
  /** The widest interior view is reached; further scroll-out leaves the room. */
  atWidestView: () => boolean;
  /** Stop RoomStreetView's own motion at the displayed pose. */
  hold: () => void;
  /** Re-apply RoomStreetView's pose after an abandoned exit. */
  resume: () => void;
}

export function createInteriorEntryChannel(): InteriorEntryChannel {
  return { suspended: false, atWidestView: () => false, hold() {}, resume() {} };
}

const ray = new Raycaster(), pointer = new Vector2();
/** A press on furniture belongs to the furniture drag, not to camera look-around. */
export function pointerHitsFurniture(scene: Object3D | undefined, camera: Camera, element: Element, clientX: number, clientY: number) {
  const group = scene?.getObjectByName(PLANNER_FURNITURE_GROUP);
  if (!group) return false;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return ray.intersectObject(group, true).length > 0;
}
