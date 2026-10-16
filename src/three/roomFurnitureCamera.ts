import type { PlacedFurniture } from "@/lib/types";
import type { CameraBounds } from "@/lib/plannerCamera";
import { dimsFor } from "./collision";

/** Planner dimensions work before the GLB finishes loading, including wall items. */
export function furnitureCameraBounds(piece: PlacedFurniture): CameraBounds {
  const { w, d, h } = dimsFor(piece);
  const cos = Math.abs(Math.cos(piece.rotation)), sin = Math.abs(Math.sin(piece.rotation));
  return {
    width: w * cos + d * sin,
    depth: w * sin + d * cos,
    height: h,
    centerX: piece.x,
    centerZ: piece.z,
    centerY: (piece.elevation ?? 0) + h / 2,
  };
}
