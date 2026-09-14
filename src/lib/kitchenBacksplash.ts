import type { CabinetPose, KitchenRoom, ModularKitchen } from "./kitchenCabinets";
import { cabinetAxes, cabinetCorners, cabinetsOverlap, fitCountertops } from "./kitchenPlacement";

export interface BacksplashPanel { id: string; width: number; height: number; thickness: number; position: CabinetPose }
export interface BacksplashSettings { mode: "full-run" | "manual"; panels: BacksplashPanel[] }
export function fitBacksplashes(kitchen: ModularKitchen): BacksplashPanel[] {
  if (!kitchen.backsplash) return [];
  if (kitchen.backsplashSettings?.mode === "manual") return kitchen.backsplashSettings.panels;
  const panels: BacksplashPanel[] = [];
  for (const top of fitCountertops(kitchen)) {
    const { front } = cabinetAxes(top.position.rotation);
    const thickness = 12;
    const panel = { id: `backsplash:${top.id}`, width: top.width, height: kitchen.wallClearance, thickness,
      position: { ...top.position, y: top.position.y + top.thickness,
        x: top.position.x - front.x * (top.depth - thickness) / 2,
        z: top.position.z - front.z * (top.depth - thickness) / 2 } };
    // At an inside corner the later board butts against the earlier board.
    const { right } = cabinetAxes(panel.position.rotation);
    for (const previous of panels) {
      if (Math.abs(Math.cos(previous.position.rotation - panel.position.rotation)) > .001) continue;
      const previousRight = cabinetAxes(previous.position.rotation).right;
      const dx = previous.position.x - panel.position.x, dz = previous.position.z - panel.position.z;
      const at = dx * right.x + dz * right.z;
      const across = -dx * previousRight.x - dz * previousRight.z;
      const reach = Math.max(...kitchen.cabinets.filter(c => top.cabinetIds.includes(c.id)).map(c => c.depth), 0) + kitchen.countertop.frontOverhang;
      if (Math.abs(across) > previous.width / 2 + .001 || Math.abs(at) > panel.width / 2 + reach + .001) continue;
      const sign = at >= 0 ? 1 : -1, fixed = -sign * panel.width / 2;
      const end = at - sign * previous.thickness / 2, shift = (fixed + end) / 2;
      panel.width = Math.abs(end - fixed);
      panel.position.x += right.x * shift;
      panel.position.z += right.z * shift;
    }
    panels.push(panel);
  }
  return panels;
}
function asCabinet(panel: BacksplashPanel) {
  return { ...panel, depth: panel.thickness } as unknown as ModularKitchen["cabinets"][number];
}
export function parseBacksplashSettings(value: unknown, room: KitchenRoom): BacksplashSettings | undefined {
  if (value === undefined) return undefined;
  const settings = value as BacksplashSettings;
  if (!settings || !["full-run", "manual"].includes(settings.mode) || !Array.isArray(settings.panels) || settings.panels.length > 80) throw new Error("Ханын хавтангийн тохиргоо буруу байна.");
  const ids = new Set<string>();
  const panels = settings.panels.map(panel => {
    if (!panel || typeof panel.id !== "string" || !panel.id || panel.id.length > 8192 || ids.has(panel.id) || !panel.position ||
      ![panel.width, panel.height, panel.thickness].every(Number.isFinite) || panel.width < 100 || panel.width > 8000 || panel.height < 100 || panel.height > 1500 || panel.thickness < 6 || panel.thickness > 40 ||
      ![panel.position.x, panel.position.y, panel.position.z, panel.position.rotation].every(Number.isFinite)) throw new Error("Ханын хавтангийн хэмжээ буруу байна.");
    ids.add(panel.id);
    if (panel.position.y < 0 || panel.position.y + panel.height > room.height || cabinetCorners(asCabinet(panel)).some(p => p.x < -.001 || p.z < -.001 || p.x > room.width + .001 || p.z > room.depth + .001)) throw new Error("Ханын хавтан өрөөний хилээс гарсан байна.");
    return { id: panel.id, width: panel.width, height: panel.height, thickness: panel.thickness, position: { x: panel.position.x, y: panel.position.y, z: panel.position.z, rotation: panel.position.rotation } };
  });
  if (panels.some((p, i) => panels.slice(i + 1).some(other => cabinetsOverlap(asCabinet(p), asCabinet(other))))) throw new Error("Ханын хавтангууд давхцаж байна.");
  return { mode: settings.mode, panels };
}
