import type { Countertop, ModularKitchen } from "./kitchenCabinets";
import { cabinetCorners, cabinetsOverlap, fitCountertops } from "./kitchenPlacement";
import { roomContainsFootprint } from "./kitchenRoomOutline";

export function detachKitchenCountertops(kitchen: ModularKitchen): ModularKitchen {
  if (kitchen.countertopLayout) return kitchen;
  return { ...kitchen, countertopLayout: { mode: "manual", panels: fitCountertops(kitchen).map(top => ({
    ...top, position: { ...top.position }, cutoutAnchor: { ...top.position }, cabinetIds: [...top.cabinetIds],
  })) } };
}

export function updateKitchenCountertop(kitchen: ModularKitchen, id: string, patch: Partial<Pick<Countertop, "position" | "width" | "depth" | "thickness">>): ModularKitchen {
  const detached = detachKitchenCountertops(kitchen);
  if (!detached.countertopLayout!.panels.some(top => top.id === id)) throw new Error("Тавцан олдсонгүй.");
  return { ...detached, countertopLayout: { mode: "manual", panels: detached.countertopLayout!.panels.map(top => top.id === id ? { ...top, ...patch } : top) } };
}

export function parseKitchenCountertopLayout(value: unknown, kitchen: ModularKitchen): ModularKitchen["countertopLayout"] {
  if (value === undefined) return undefined;
  const layout = value as NonNullable<ModularKitchen["countertopLayout"]>;
  if (!layout || layout.mode !== "manual" || !Array.isArray(layout.panels) || layout.panels.length > 80) throw new Error("Тавцангийн байрлалын тохиргоо буруу байна.");
  const ids = new Set<string>();
  const panels = layout.panels.map(top => {
    if (!top || typeof top.id !== "string" || !top.id || top.id.length > 8192 || ids.has(top.id) ||
      !Array.isArray(top.cabinetIds) || top.cabinetIds.some(id => typeof id !== "string" || id.length > 100) ||
      !Number.isFinite(top.width) || top.width < 100 || top.width > 8000 || !Number.isFinite(top.depth) || top.depth < 100 || top.depth > 2000 ||
      ![20, 28, 30, 38, 40].includes(top.thickness) || !["laminate", "granite", "wood"].includes(top.material) ||
      (top.finish !== undefined && !["matte", "gloss", "oak", "walnut", "marble", "concrete"].includes(top.finish)) ||
      (top.color !== undefined && !/^#[0-9a-f]{6}$/i.test(top.color)) ||
      (top.materialId !== undefined && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(top.materialId)) ||
      !Number.isInteger(top.frontOverhang) || top.frontOverhang < 0 || top.frontOverhang > 100)
      throw new Error("Тавцангийн хэмжээ, материал буруу байна.");
    for (const pose of [top.position, ...(top.cutoutAnchor ? [top.cutoutAnchor] : [])])
      if (!pose || ![pose.x, pose.y, pose.z, pose.rotation].every(Number.isFinite)) throw new Error("Тавцангийн байрлал буруу байна.");
    const footprint = { ...top, height: top.thickness };
    if (top.position.y < 0 || top.position.y + top.thickness > kitchen.room.height || !roomContainsFootprint(kitchen.room, cabinetCorners(footprint)))
      throw new Error("Тавцан өрөөний хилээс гарсан байна.");
    if (kitchen.cabinets.some(cabinet => cabinetsOverlap(footprint, cabinet))) throw new Error("Тавцан шүүгээний их биетэй давхцаж байна.");
    ids.add(top.id);
    return { id: top.id, cabinetIds: [...top.cabinetIds], width: top.width, depth: top.depth, thickness: top.thickness,
      frontOverhang: top.frontOverhang, material: top.material, ...(top.finish ? { finish: top.finish } : {}),
      ...(top.materialId ? { materialId: top.materialId } : {}), ...(top.color ? { color: top.color } : {}), position: { ...top.position },
      ...(top.cutoutAnchor ? { cutoutAnchor: { ...top.cutoutAnchor } } : {}) };
  });
  if (panels.some((top, index) => panels.slice(index + 1).some(other => cabinetsOverlap({ ...top, height: top.thickness }, { ...other, height: other.thickness }))))
    throw new Error("Тавцангууд давхцаж байна.");
  return { mode: "manual", panels };
}
