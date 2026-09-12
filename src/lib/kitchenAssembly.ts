import { FINISHES, type Finish, type FrontStyle } from "./kitchen";
import { createCabinet, createModularKitchen, validateCabinet, type ModularCabinet, type ModularKitchen } from "./kitchenCabinets";
import { cabinetAxes, cabinetCorners, fitCountertops, placementIssues, resolveElevations } from "./kitchenPlacement";

export type SavedKitchen = { id: string; name: string; design: ModularKitchen; createdAt: string; updatedAt: string };
export type KitchenSnapshot = { id: string; name: string; design: ModularKitchen };
export const cloneKitchen = (kitchen: ModularKitchen): ModularKitchen => JSON.parse(JSON.stringify(kitchen));
export function createUnifiedKitchen(): ModularKitchen {
  const kitchen = createModularKitchen();
  const kinds = ["drawers", "sink", "doors", "hob", "doors"] as const;
  kitchen.cabinets = kinds.flatMap((opening, index) => {
    const base = createCabinet("base", `base-${index + 1}`);
    base.position.x = 500 + index * 600;
    base.opening = opening; base.finish = "oak"; base.frontStyle = "flat";
    if (opening === "drawers") base.drawerCount = 3;
    const upper = createCabinet("wall", `wall-${index + 1}`);
    upper.position.x = base.position.x; upper.finish = "oak"; upper.color = "#e5d6bd"; upper.material = "wood";
    return opening === "hob" ? [base] : [base, upper];
  });
  kitchen.countertop.finish = "marble"; kitchen.backsplash = true;
  return resolveElevations(kitchen);
}
/** Closed, authored geometry bounds in mm. No viewer-dependent Box3 normalization. */
export function kitchenEnvelope(kitchen: ModularKitchen) {
  const points = kitchen.cabinets.flatMap(c => {
    const frontExtra = c.opening === "open" || c.handleStyle === "push-open" ? 0 : c.handleStyle === "knob" ? 31 : 22;
    const { front } = cabinetAxes(c.position.rotation);
    return cabinetCorners({ ...c, depth: c.depth + frontExtra, position: { ...c.position,
      x: c.position.x + front.x * frontExtra / 2, z: c.position.z + front.z * frontExtra / 2 } });
  });
  const tops = fitCountertops(kitchen);
  for (const top of tops) {
    points.push(...cabinetCorners({ ...kitchen.cabinets[0], width: top.width as ModularCabinet["width"], depth: top.depth, position: top.position }));
  }
  if (!points.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, centerX: 0, centerZ: 0, w: 0, d: 0, h: 0 };
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
  const h = Math.max(...kitchen.cabinets.map(c => c.position.y + c.height), ...tops.map(t => t.position.y + t.thickness),
    ...kitchen.cabinets.filter(c => c.opening === "sink").map(c => c.height + kitchen.countertop.thickness + 260),
    ...(kitchen.backsplash ? tops.map(t => t.position.y + t.thickness + kitchen.wallClearance) : []));
  return { minX, maxX, minZ, maxZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    w: (maxX - minX) / 1000, d: (maxZ - minZ) / 1000, h: h / 1000 };
}
export function applyKitchenAppearance(kitchen: ModularKitchen, ids: string[] | null,
  patch: Partial<Pick<ModularCabinet, "finish" | "color" | "handleStyle" | "frontStyle">>): ModularKitchen {
  return { ...kitchen, cabinets: kitchen.cabinets.map(c => ids && !ids.includes(c.id) ? c : {
    ...c, ...patch, ...(patch.finish ? { material: patch.finish === "gloss" ? "gloss" as const : ["oak", "walnut"].includes(patch.finish) ? "wood" as const : "matte" as const } : {}),
  }) };
}
/** Rearrange this same collection, including its finishes and IDs. */
export function arrangeKitchen(kitchen: ModularKitchen, layout: "straight" | "l-right" | "l-left") {
  const next = cloneKitchen(kitchen), floor = next.cabinets.filter(c => c.type !== "wall");
  const oldFloor = kitchen.cabinets.filter(c => c.type !== "wall");
  const split = layout === "straight" ? floor.length : Math.max(1, Math.ceil(floor.length * .6));
  let along = 200;
  const mainLength = floor.slice(0, split).reduce((sum, c) => sum + c.width, 0);
  const backX = layout === "l-left" ? 200 : 200 + mainLength;
  floor.forEach((c, i) => {
    if (i === split) along = Math.max(...floor.slice(0, split).map(item => item.depth));
    if (i < split) c.position = { x: along + c.width / 2, z: c.depth / 2, y: 0, rotation: 0 };
    else c.position = { x: backX + (layout === "l-left" ? c.depth / 2 : -c.depth / 2), z: along + c.width / 2, y: 0, rotation: layout === "l-left" ? Math.PI / 2 : -Math.PI / 2 };
    along += c.width;
  });
  for (const wall of next.cabinets.filter(c => c.type === "wall")) {
    const nearest = oldFloor.map(c => ({ c, distance: Math.hypot(c.position.x - wall.position.x, c.position.z - wall.position.z) })).sort((a, b) => a.distance - b.distance)[0]?.c;
    const support = floor.find(c => c.id === nearest?.id);
    if (support) { const { front } = cabinetAxes(support.position.rotation);
      wall.position = { ...wall.position, rotation: support.position.rotation,
        x: support.position.x + front.x * (wall.depth - support.depth) / 2,
        z: support.position.z + front.z * (wall.depth - support.depth) / 2 };
    }
  }
  // L arms use the side room wall; translating the whole main run keeps cabinet sizes fixed.
  if (layout !== "straight") {
    const shift = layout === "l-left" ? -200 : next.room.width - backX;
    next.cabinets.forEach(c => { c.position.x += shift; });
  }
  return resolveElevations(next);
}
/** Strict parsing for saved or submitted JSON. No arbitrary fields reach the renderer. */
export function parseKitchen(value: unknown): ModularKitchen {
  if (!value || typeof value !== "object") throw new Error("Гарнитурын өгөгдөл буруу байна.");
  const raw = value as ModularKitchen;
  if (raw.version !== 1 || !raw.room || !raw.countertop || !Array.isArray(raw.cabinets) || !raw.cabinets.length || raw.cabinets.length > 80) throw new Error("1–80 шүүгээтэй загвар байна.");
  if (![raw.room.width, raw.room.depth].every(n => Number.isInteger(n) && n >= 2000 && n <= 8000) || !Number.isInteger(raw.room.height) || raw.room.height < 2200 || raw.room.height > 3500) throw new Error("Өрөөний хэмжээ буруу байна.");
  if (!Number.isInteger(raw.wallClearance) || raw.wallClearance < 450 || raw.wallClearance > 600 || raw.countertop.thickness !== 30 || raw.countertop.frontOverhang !== 20 || !["laminate", "granite", "wood"].includes(raw.countertop.material)) throw new Error("Тавцангийн тохиргоо буруу байна.");
  const finishes = FINISHES.map(f => f.id), ids = new Set<string>();
  const cabinets = raw.cabinets.map(c => {
    if (!c || typeof c.id !== "string" || !c.id.length || c.id.length > 80 || ids.has(c.id) || !c.position || ![c.position.x, c.position.y, c.position.z, c.position.rotation].every(n => Number.isFinite(n) && Math.abs(n) <= 100000) || typeof c.autoElevation !== "boolean" || typeof c.fitToCeiling !== "boolean") throw new Error("Шүүгээний мэдээлэл буруу байна.");
    ids.add(c.id);
    const error = validateCabinet(c); if (error) throw new Error(error);
    if ((c.finish !== undefined && !finishes.includes(c.finish)) || (c.frontStyle !== undefined && !["flat", "shaker", "glass"].includes(c.frontStyle)) || (c.opening !== undefined && !["doors", "drawers", "open", "sink", "hob"].includes(c.opening))) throw new Error("Хаалганы тохиргоо буруу байна.");
    if (["sink", "hob"].includes(c.opening ?? "") && (c.type !== "base" || c.width < 600)) throw new Error("Угаалтуур, плитка 600 мм-ээс өргөн доод шүүгээнд байрлана.");
    return { id: c.id, type: c.type, width: c.width, height: c.height, depth: c.depth, doorCount: c.doorCount, drawerCount: c.drawerCount, handleStyle: c.handleStyle, material: c.material, color: c.color,
      position: { x: c.position.x, y: c.position.y, z: c.position.z, rotation: c.position.rotation }, autoElevation: c.autoElevation, fitToCeiling: c.fitToCeiling,
      ...(c.finish ? { finish: c.finish as Finish } : {}), ...(c.frontStyle ? { frontStyle: c.frontStyle as FrontStyle } : {}), ...(c.opening ? { opening: c.opening } : {}) };
  });
  if (raw.countertop.finish !== undefined && !finishes.includes(raw.countertop.finish)) throw new Error("Тавцангийн материал буруу байна.");
  const next: ModularKitchen = { version: 1, room: { width: raw.room.width, depth: raw.room.depth, height: raw.room.height }, cabinets, wallClearance: raw.wallClearance,
    countertop: { thickness: 30, frontOverhang: 20, material: raw.countertop.material, ...(raw.countertop.finish ? { finish: raw.countertop.finish } : {}) }, backsplash: raw.backsplash === true };
  const issue = placementIssues(next).find(i => i.severity === "error"); if (issue) throw new Error(issue.message);
  return next;
}
