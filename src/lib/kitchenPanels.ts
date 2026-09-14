import type { ModularCabinet } from "./kitchenCabinets";
import { hasCooktop, ovenSlot } from "./plitka";

/** Manufacturing dimensions are authored in millimetres. Rendering only converts units. */
export const PANEL_THICKNESS = 18;
export const FRONT_GAP = 2;
export const PLINTH_HEIGHT = 80;
export const DRAWER_SIDE_THICKNESS = 16;
export const DRAWER_BOTTOM_THICKNESS = 6;
export const DRAWER_RUNNER_CLEARANCE = 13;
export type PanelRole = "frame" | "door-front" | "drawer-front" | "drawer-box" | "filler" | "glass";
export type PanelVector = [number, number, number];
export interface KitchenPanel {
  id: string;
  name: string;
  role: PanelRole;
  size: PanelVector;
  position: PanelVector;
}
export interface CabinetFront {
  id: string;
  kind: "door-front" | "drawer-front" | "filler";
  width: number;
  height: number;
  position: PanelVector;
  hinge?: "left" | "right";
  drawerIndex?: number;
}
export interface CabinetDrawer {
  id: string;
  index: number;
  travel: number;
  panels: KitchenPanel[];
}
const mm = (value: number) => Math.round(value * 1000) / 1000;
// Keep half-millimicron centres: rounding centres to .001 would alter a 2 mm joint.
const vector = (v: PanelVector): PanelVector => v.map(value => Math.round(value * 1e6) / 1e6) as PanelVector;
function panel(id: string, name: string, role: PanelRole, size: PanelVector, position: PanelVector): KitchenPanel {
  return { id, name, role, size: size.map(mm) as PanelVector, position: vector(position) };
}
export function cabinetToe(c: ModularCabinet) { return c.type === "base" ? PLINTH_HEIGHT : 0; }
function hasCarcass(c: ModularCabinet) {
  return c.opening !== "refrigerator" && !(c.opening === "hood" && c.hoodMount === "wall");
}
/** Butt-jointed panels: back fits between sides, horizontal panels stop at the back. */
export function cabinetCarcassPanels(c: ModularCabinet): KitchenPanel[] {
  if (!hasCarcass(c)) return [];
  const t = PANEL_THICKNESS, w = c.width, h = c.height, d = c.depth, toe = cabinetToe(c);
  const bottom = c.opening === "hood" ? 80 : toe;
  const panels = [
    panel("side-left", "Зүүн хажуу", "frame", [t, h - bottom, d - t], [-w / 2 + t / 2, (h + bottom) / 2, -t / 2]),
    panel("side-right", "Баруун хажуу", "frame", [t, h - bottom, d - t], [w / 2 - t / 2, (h + bottom) / 2, -t / 2]),
    panel("back", "Ар хавтан", "frame", [w - t * 2, h - bottom, t], [0, (h + bottom) / 2, -d / 2 + t / 2]),
  ];
  const slot = ovenSlot(c);
  const levels: [string, string, number][] = slot
    ? [["bottom", "Ёроол", toe + t / 2], ["oven-support", "Зуухны доод тулгуур", slot.bottom - t / 2],
      ["oven-top", "Зуухны дээд тавиур", slot.top + t / 2], ...(c.type === "tall" ? [["top", "Дээд хавтан", h - t / 2] as [string, string, number]] : [])]
    : [["bottom", "Ёроол", bottom + t / 2],
      ...(!["sink", "drawers", "hood"].includes(c.opening ?? "") ? [["shelf", "Дотор тавиур", (h + toe) / 2] as [string, string, number]] : []),
      ...(!hasCooktop(c) && c.opening !== "sink" ? [["top", "Дээд хавтан", h - t / 2] as [string, string, number]] : [])];
  for (const [id, name, y] of levels) {
    // A full-height drawer box must remain free of a shelf, including mixed door/drawer units.
    if (id === "shelf" && c.drawerCount > 0 && c.height - 120 * c.drawerCount < y + t / 2) continue;
    panels.push(panel(id, name, "frame", [w - t * 2, t, d - t * 2], [0, y, 0]));
  }
  return panels;
}
/** Actual face dimensions include 1 mm perimeter clearances and 2 mm between neighbours. */
export function cabinetFronts(c: ModularCabinet): CabinetFront[] {
  if (!hasCarcass(c) || c.opening === "open") return [];
  const w = c.width, h = c.height, d = c.depth, toe = c.opening === "hood" ? 80 : cabinetToe(c), slot = ovenSlot(c);
  const fronts: CabinetFront[] = [];
  const z = d / 2 - PANEL_THICKNESS / 2;
  const doorRange = (id: string, left: number, right: number, bottom: number, top: number, count = c.doorCount) => {
    const cell = (right - left) / count;
    for (let i = 0; i < count; i++) {
      fronts.push({ id: `${id}-${i}`, kind: "door-front", width: mm(cell - FRONT_GAP), height: mm(top - bottom - FRONT_GAP),
        position: vector([left + cell * (i + .5), (bottom + top) / 2, z]), hinge: i === count - 1 && count > 1 ? "right" : "left" });
    }
  };
  if (slot) {
    if (c.type === "tall") {
      doorRange("lower-door", -w / 2, w / 2, toe, slot.bottom - PANEL_THICKNESS);
      doorRange("upper-door", -w / 2, w / 2, slot.top + PANEL_THICKNESS, h);
    } else if (slot.bottom - PANEL_THICKNESS - toe > FRONT_GAP) {
      const top = slot.bottom - PANEL_THICKNESS;
      fronts.push({ id: "oven-lower-filler", kind: "filler", width: w - FRONT_GAP, height: top - toe - FRONT_GAP,
        position: [0, (top + toe) / 2, z] });
    }
    return fronts;
  }
  if (c.corner) {
    const blindLeft = c.cornerSide !== "right", access = w - d;
    fronts.push({ id: "corner-blind-fascia", kind: "filler", width: d - FRONT_GAP, height: h - toe - FRONT_GAP,
      position: [blindLeft ? -access / 2 : access / 2, (h + toe) / 2, z] });
    doorRange("corner-door", blindLeft ? -w / 2 + d : -w / 2, blindLeft ? w / 2 : w / 2 - d, toe, h, 1);
    return fronts;
  }
  const count = c.opening === "drawers" ? Math.max(1, c.drawerCount) : c.drawerCount;
  const drawerCell = c.opening === "drawers" ? (h - toe) / count : 120;
  const doorTop = h - drawerCell * count;
  if (doorTop - toe > FRONT_GAP) doorRange("door", -w / 2, w / 2, toe, doorTop);
  for (let i = 0; i < count; i++) {
    const top = mm(h - drawerCell * i), bottom = mm(h - drawerCell * (i + 1));
    fronts.push({ id: `drawer-front-${i}`, kind: "drawer-front", width: w - FRONT_GAP, height: mm(top - bottom - FRONT_GAP),
      position: vector([0, (top + bottom) / 2, z]), drawerIndex: i });
  }
  return fronts;
}
/** Complete drawer box with separate sides, back, inner front and a bottom underneath. */
export function cabinetDrawers(c: ModularCabinet): CabinetDrawer[] {
  const faces = cabinetFronts(c).filter(front => front.kind === "drawer-front");
  const t = DRAWER_SIDE_THICKNESS, bottomThickness = DRAWER_BOTTOM_THICKNESS;
  const width = c.width - PANEL_THICKNESS * 2 - DRAWER_RUNNER_CLEARANCE * 2;
  const depth = c.depth - 70;
  return faces.map((face, index) => {
    const height = Math.min(180, face.height - 40);
    const floor = face.position[1] - face.height / 2 + 20;
    const front = c.depth / 2 - PANEL_THICKNESS;
    const z = front - depth / 2;
    const y = floor + bottomThickness + (height - bottomThickness) / 2;
    const panels = [
      panel(`${face.id}-box-bottom`, "Шургуулганы ёроол", "drawer-box", [width, bottomThickness, depth], [0, floor + bottomThickness / 2, z]),
      panel(`${face.id}-box-left`, "Шургуулганы зүүн хажуу", "drawer-box", [t, height - bottomThickness, depth], [-width / 2 + t / 2, y, z]),
      panel(`${face.id}-box-right`, "Шургуулганы баруун хажуу", "drawer-box", [t, height - bottomThickness, depth], [width / 2 - t / 2, y, z]),
      panel(`${face.id}-box-back`, "Шургуулганы ар", "drawer-box", [width - t * 2, height - bottomThickness, t], [0, y, front - depth + t / 2]),
      panel(`${face.id}-box-front`, "Шургуулганы дотор нүүр", "drawer-box", [width - t * 2, height - bottomThickness, t], [0, y, front - t / 2]),
    ];
    // Retain the existing 180 mm bottom-drawer opening; upper drawers open less.
    return { id: `drawer-${index}`, index, travel: mm(Math.min(180, depth * .75) * (index + 1) / faces.length), panels };
  });
}
/** Decorative framed fronts are also split into their actual non-overlapping pieces. */
export function frontPanels(c: ModularCabinet, front: CabinetFront): KitchenPanel[] {
  const role = front.kind, [x, y, z] = front.position, w = front.width, h = front.height;
  const style = role === "filler" ? "flat" : c.components?.find(item => item.type === role)?.model ?? c.frontStyle ?? "flat";
  if (style === "flat" || w <= 60 || h <= 60)
    return [panel(front.id, role === "drawer-front" ? "Шургуулганы нүүр" : role === "filler" ? "Битүү нүүр" : "Хаалганы навч", role, [w, h, PANEL_THICKNESS], [x, y, z])];
  return [
    panel(`${front.id}-left`, "Нүүрний зүүн хүрээ", role, [30, h, PANEL_THICKNESS], [x - w / 2 + 15, y, z]),
    panel(`${front.id}-right`, "Нүүрний баруун хүрээ", role, [30, h, PANEL_THICKNESS], [x + w / 2 - 15, y, z]),
    panel(`${front.id}-top`, "Нүүрний дээд хүрээ", role, [w - 60, 30, PANEL_THICKNESS], [x, y + h / 2 - 15, z]),
    panel(`${front.id}-bottom`, "Нүүрний доод хүрээ", role, [w - 60, 30, PANEL_THICKNESS], [x, y - h / 2 + 15, z]),
    panel(`${front.id}-inset`, style === "glass" ? "Шилэн нүүр" : "Нүүрний гол хавтан", style === "glass" ? "glass" : role,
      [w - 60, h - 60, style === "glass" ? 6 : 12], [x, y, z]),
  ];
}
export function cabinetManufacturingPanels(c: ModularCabinet): KitchenPanel[] {
  return [...cabinetCarcassPanels(c), ...cabinetFronts(c).flatMap(front => frontPanels(c, front)), ...cabinetDrawers(c).flatMap(drawer => drawer.panels)];
}
