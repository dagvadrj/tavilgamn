import { Plane, Vector3 } from "three";
import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { furnitureWallId } from "@/lib/furnitureAttachment";

/** Top view uses a horizontal plane so its ray is never parallel to a wall. */
export function furnitureDragPlane(piece: PlacedFurniture, room: RoomShape, plan: boolean) {
  const attachment = piece.attachment;
  const wall = attachment?.kind === "wall"
    ? getRoomGeometry(room).segments.find(s => furnitureWallId(s) === attachment.segmentId)
    : undefined;
  if (attachment?.kind === "wall" && !wall) return null;
  const normal = wall && !plan ? new Vector3(wall.nx, 0, wall.nz) : new Vector3(0, 1, 0);
  return new Plane().setFromNormalAndCoplanarPoint(normal, new Vector3(piece.x, piece.elevation ?? 0, piece.z));
}
