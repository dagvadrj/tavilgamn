import type { ModularCabinet } from "./kitchenCabinets";
import { cabinetToe } from "./kitchenPanels";

/** One front of a cabinet that has no catalog model yet, in millimetres from the cabinet's bottom-left. */
export type PlaceholderFront = { x: number; y: number; width: number; height: number; kind: "door" | "drawer" };

/** Gap between neighbouring fronts; wide enough to read as a line from across the room. */
export const PLACEHOLDER_FRONT_GAP = 3;
/** Drawer height above doors on a mixed base cabinet («1 хаалга, 1 шургуулга»). */
const MIXED_DRAWER_HEIGHT = 150;

/**
 * The door and drawer split a placeholder box draws on its face, so a cabinet
 * still reads as a cabinet before a 3D model is chosen. Open shelving and
 * appliances get no fronts.
 */
export function placeholderFronts(cabinet: ModularCabinet): PlaceholderFront[] {
  if (cabinet.opening === "open" || cabinet.opening === "hood" || cabinet.opening === "refrigerator") return [];
  const gap = PLACEHOLDER_FRONT_GAP;
  const toe = cabinetToe(cabinet);
  const bottom = toe + gap / 2;
  const top = cabinet.height - gap / 2;
  const left = gap / 2;
  const width = cabinet.width - gap;
  const fronts: PlaceholderFront[] = [];
  const drawers = cabinet.type === "wall" ? 0 : Math.max(0, Math.min(4, cabinet.drawerCount));
  if (cabinet.opening === "drawers" && drawers) {
    const pitch = (top - bottom + gap) / drawers;
    for (let i = 0; i < drawers; i++)
      fronts.push({ x: left, y: bottom + i * pitch, width, height: pitch - gap, kind: "drawer" });
    return fronts;
  }
  let doorTop = top;
  for (let i = 0; i < drawers; i++) {
    const y = doorTop - (MIXED_DRAWER_HEIGHT - gap);
    fronts.push({ x: left, y, width, height: MIXED_DRAWER_HEIGHT - gap, kind: "drawer" });
    doorTop = y - gap;
  }
  const doors = cabinet.doorCount === 2 ? 2 : 1;
  const doorWidth = (width + gap) / doors - gap;
  for (let i = 0; i < doors; i++)
    fronts.push({ x: left + i * (doorWidth + gap), y: bottom, width: doorWidth, height: doorTop - bottom, kind: "door" });
  return fronts;
}
