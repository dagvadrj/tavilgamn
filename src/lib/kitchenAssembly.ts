import { cabinetFrontExtra, hasCooktop } from "./plitka";
import { getComponents, getComponentSize, parseComponents } from "./kitchenComponents";
import { FINISHES, type Finish, type FrontStyle } from "./kitchen";
import { createCabinet, createModularKitchen, validateCabinet, type KitchenLayout, type ModularCabinet, type ModularKitchen } from "./kitchenCabinets";
import { cabinetAxes, cabinetCorners, cabinetsOverlap, fitCountertops, placementIssues, resolveElevations } from "./kitchenPlacement";
import { fitBacksplashes, parseBacksplashSettings } from "./kitchenBacksplash";

export type SavedKitchen = { id: string; name: string; design: ModularKitchen; createdAt: string; updatedAt: string };
export type KitchenSnapshot = { id: string; name: string; design: ModularKitchen };
export const cloneKitchen = (kitchen: ModularKitchen): ModularKitchen => JSON.parse(JSON.stringify(kitchen));
export function createUnifiedKitchen(): ModularKitchen {
  const kitchen = createModularKitchen();
  const kinds = ["drawers", "sink", "doors", "oven", "doors"] as const;
  kitchen.cabinets = kinds.flatMap((opening, index) => {
    const base = createCabinet("base", `base-${index + 1}`);
    base.position.x = 500 + index * 600;
    base.opening = opening; base.finish = "oak"; base.frontStyle = "flat";
    if (opening === "drawers") base.drawerCount = 3;
    const upper = createCabinet("wall", `wall-${index + 1}`);
    upper.position.x = base.position.x; upper.finish = "oak"; upper.color = "#e5d6bd"; upper.material = "wood";
    return opening === "oven" ? [base] : [base, upper];
  });
  kitchen.countertop.finish = "marble"; kitchen.backsplash = true;
  return resolveElevations(kitchen);
}
/** Closed, authored geometry bounds in mm. No viewer-dependent Box3 normalization. */
export function kitchenEnvelope(kitchen: ModularKitchen) {
  const points = kitchen.cabinets.flatMap(c => {
    const frontExtra = cabinetFrontExtra(c);
    const { front } = cabinetAxes(c.position.rotation);
    return cabinetCorners({ ...c, depth: c.depth + frontExtra, position: { ...c.position,
      x: c.position.x + front.x * frontExtra / 2, z: c.position.z + front.z * frontExtra / 2 } });
  });
  const tops = fitCountertops(kitchen);
  for (const top of tops) {
    points.push(...cabinetCorners({ ...kitchen.cabinets[0], width: top.width as ModularCabinet["width"], depth: top.depth, position: top.position }));
  }
  const backsplashes = fitBacksplashes(kitchen);
  for (const panel of backsplashes) points.push(...cabinetCorners({ ...kitchen.cabinets[0], width: panel.width, depth: panel.thickness, position: panel.position }));
  if (!points.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, centerX: 0, centerZ: 0, w: 0, d: 0, h: 0 };
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
  const h = Math.max(...kitchen.cabinets.map(c => c.position.y + c.height), ...tops.map(t => t.position.y + t.thickness),
    ...kitchen.cabinets.filter(hasCooktop).map(c => c.height + kitchen.countertop.thickness + 3),
    ...kitchen.cabinets.filter(c => c.opening === "sink").map(c => c.height + kitchen.countertop.thickness + getComponentSize(c, getComponents(c).find(item => item.type === "tap")!).height),
    ...backsplashes.map(panel => panel.position.y + panel.height));
  return { minX, maxX, minZ, maxZ, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2,
    w: (maxX - minX) / 1000, d: (maxZ - minZ) / 1000, h: h / 1000 };
}
export function applyKitchenAppearance(kitchen: ModularKitchen, ids: string[] | null,
  patch: Partial<Pick<ModularCabinet, "finish" | "color" | "handleStyle" | "frontStyle">>): ModularKitchen {
  return { ...kitchen, cabinets: kitchen.cabinets.map(c => ids && !ids.includes(c.id) ? c : {
    ...c, ...patch, ...(c.components ? { components: c.components.map(item => {
      if (["door-front", "drawer-front"].includes(item.type)) return { ...item,
        ...(patch.frontStyle ? { model: patch.frontStyle } : {}), ...(patch.color ? { color: patch.color } : {}), ...(patch.finish ? { finish: patch.finish } : {}) };
      if (item.type === "handle" && patch.handleStyle) {
        if (patch.handleStyle === "bar") return { ...item, model: patch.handleStyle };
        const { size: _size, ...rest } = item;
        return { ...rest, model: patch.handleStyle };
      }
      return item;
    }) } : {}), ...(patch.finish ? { material: patch.finish === "gloss" ? "gloss" as const : ["oak", "walnut"].includes(patch.finish) ? "wood" as const : "matte" as const } : {}),
  }) };
}
/** Resize around the outside corner edge; the rear wall contact is preserved. */
export function replaceCorner(cabinet: ModularCabinet, enabled: boolean, side: "left" | "right" = cabinet.cornerSide ?? "right"): ModularCabinet {
  if (cabinet.type === "tall" || ["sink", "hob", "oven", "hood", "refrigerator"].includes(cabinet.opening ?? "")) return cabinet;
  const width = enabled ? cabinet.type === "base" ? 1000 : 800 : 600;
  const { right } = cabinetAxes(cabinet.position.rotation), sign = side === "right" ? 1 : -1;
  const shift = sign * (cabinet.width - width) / 2;
  return { ...cabinet, width, corner: enabled, cornerSide: side, doorCount: 1, drawerCount: 0, opening: "doors",
    ...(cabinet.components ? { components: cabinet.components.filter(c => !["drawer-front", "handle", "door-front"].includes(c.type)) } : {}),
    position: { ...cabinet.position, x: cabinet.position.x + right.x * shift, z: cabinet.position.z + right.z * shift } };
}
export function arrangeKitchen(kitchen: ModularKitchen, layout: KitchenLayout) {
  const next = cloneKitchen(kitchen), floor = next.cabinets.filter(c => c.type !== "wall"), upper = next.cabinets.filter(c => c.type === "wall");
  next.layout = layout;
  const oldFloor = kitchen.cabinets.filter(c => c.type !== "wall");
  const supportIds = new Map(upper.map(wall => [wall.id, oldFloor.map(c => ({ id: c.id, distance: Math.hypot(c.position.x - wall.position.x, c.position.z - wall.position.z) }))
    .sort((a, b) => a.distance - b.distance)[0]?.id]));
  const isL = layout === "l-left" || layout === "l-right";
  const split = layout === "straight" ? floor.length : Math.min(Math.max(1, Math.ceil(floor.length * (isL ? .6 : .5))), Math.max(1, floor.length - 1));
  const cornerIndex = layout === "l-left" ? 0 : split - 1;
  if (isL && floor.length > 1) {
    const ordinary = (c: ModularCabinet) => c.type === "base" && ["doors", undefined].includes(c.opening);
    let index = floor.findIndex(c => c.corner === true);
    if (index < 0) index = floor.findIndex((c, i) => i < split && ordinary(c));
    if (index < 0) index = floor.findIndex(ordinary);
    if (index >= 0) {
      [floor[index], floor[cornerIndex]] = [floor[cornerIndex], floor[index]];
      const corner = floor[cornerIndex], side = layout === "l-left" ? "left" : "right";
      if (corner.corner !== false) Object.assign(corner, replaceCorner(corner, true, side));
      const cornerUpper = upper.find(w => supportIds.get(w.id) === corner.id && w.opening !== "hood");
      if (cornerUpper && cornerUpper.corner !== false) Object.assign(cornerUpper, replaceCorner(cornerUpper, true, side));
    }
  }
  const placeRun = (items: ModularCabinet[], wall: "back" | "left" | "right" | "front", start: number) => {
    let along = start;
    for (const c of items) {
      const centre = along + c.width / 2, y = c.position.y;
      c.position = wall === "back" ? { x: centre, z: c.depth / 2, y, rotation: 0 }
        : wall === "front" ? { x: next.room.width - centre, z: next.room.depth - c.depth / 2, y, rotation: Math.PI }
        : wall === "left" ? { x: c.depth / 2, z: centre, y, rotation: Math.PI / 2 }
        : { x: next.room.width - c.depth / 2, z: centre, y, rotation: -Math.PI / 2 };
      along += c.width;
    }
  };
  const main = floor.slice(0, split), returning = floor.slice(split), mainWidth = main.reduce((sum, c) => sum + c.width, 0);
  placeRun(main, "back", layout === "l-left" ? 0 : layout === "l-right" ? next.room.width - mainWidth : 200);
  if (returning.length) placeRun(returning, layout === "double-side" ? "front" : layout === "l-left" ? "left" : "right", isL ? Math.max(0, ...main.map(c => c.depth)) : 200);
  const mainIds = new Set(main.map(c => c.id));
  const upperMain = upper.filter(c => mainIds.has(supportIds.get(c.id) ?? "") || !supportIds.get(c.id));
  const upperReturn = upper.filter(c => !upperMain.includes(c));
  const order = (a: ModularCabinet, b: ModularCabinet) => floor.findIndex(c => c.id === supportIds.get(a.id)) - floor.findIndex(c => c.id === supportIds.get(b.id));
  upperMain.sort(order); upperReturn.sort(order);
  const upperWidth = upperMain.reduce((sum, c) => sum + c.width, 0);
  placeRun(upperMain, "back", layout === "l-left" ? 0 : layout === "l-right" ? next.room.width - upperWidth : 200);
  if (upperReturn.length) placeRun(upperReturn, layout === "double-side" ? "front" : layout === "l-left" ? "left" : "right", isL ? Math.max(0, ...upperMain.map(c => c.depth)) : 200);
  // A hood follows its cooker, even when upper and lower corner widths differ.
  for (const hood of upper.filter(c => c.opening === "hood")) {
    const originalHood = kitchen.cabinets.find(c => c.id === hood.id)!;
    const cookers = oldFloor.filter(hasCooktop);
    const cookerId = cookers.sort((a, b) => Math.hypot(a.position.x - originalHood.position.x, a.position.z - originalHood.position.z) - Math.hypot(b.position.x - originalHood.position.x, b.position.z - originalHood.position.z))[0]?.id ?? supportIds.get(hood.id);
    const support = floor.find(c => c.id === cookerId);
    if (support) {
      const { front } = cabinetAxes(support.position.rotation), setback = (hood.depth - support.depth) / 2;
      hood.position = { ...hood.position, rotation: support.position.rotation,
        x: support.position.x + front.x * setback, z: support.position.z + front.z * setback };
    }
  }
  // Tall appliances occupy the upper volume too. Find the nearest exact free
  // edge on each upper's chosen wall while keeping corner and hood anchors.
  const fixed = upper.filter(c => c.corner || c.opening === "hood"), accepted = [...floor, ...fixed];
  for (const cabinet of upper.filter(c => !fixed.includes(c))) {
    const { right } = cabinetAxes(cabinet.position.rotation), desired = cabinet.position.x * right.x + cabinet.position.z * right.z;
    const roomExtent = [[0, 0], [next.room.width, 0], [0, next.room.depth], [next.room.width, next.room.depth]].map(([x, z]) => x * right.x + z * right.z);
    const starts = new Set([desired, Math.min(...roomExtent) + cabinet.width / 2, Math.max(...roomExtent) - cabinet.width / 2]);
    for (const obstacle of accepted) {
      const edges = cabinetCorners(obstacle).map(p => p.x * right.x + p.z * right.z);
      starts.add(Math.min(...edges) - cabinet.width / 2); starts.add(Math.max(...edges) + cabinet.width / 2);
    }
    for (const along of [...starts].sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired))) {
      const pose = { ...cabinet.position, x: cabinet.position.x + right.x * (along - desired), z: cabinet.position.z + right.z * (along - desired) };
      const placed = resolveElevations({ ...next, cabinets: [...accepted, { ...cabinet, position: pose }] }).cabinets.at(-1)!;
      if (cabinetCorners(placed).some(p => p.x < -1e-6 || p.z < -1e-6 || p.x > next.room.width + 1e-6 || p.z > next.room.depth + 1e-6) || accepted.some(c => cabinetsOverlap(placed, c))) continue;
      Object.assign(cabinet, placed); break;
    }
    accepted.push(cabinet);
  }
  return resolveElevations(next);
}
/** Strict parsing for saved or submitted JSON. No arbitrary fields reach the renderer. */
export function parseKitchen(value: unknown): ModularKitchen {
  if (!value || typeof value !== "object") throw new Error("Гарнитурын өгөгдөл буруу байна.");
  const raw = value as ModularKitchen;
  if (raw.version !== 1 || !raw.room || !raw.countertop || !Array.isArray(raw.cabinets) || !raw.cabinets.length || raw.cabinets.length > 80) throw new Error("1–80 шүүгээтэй загвар байна.");
  if (![raw.room.width, raw.room.depth].every(n => Number.isInteger(n) && n >= 2000 && n <= 8000) || !Number.isInteger(raw.room.height) || raw.room.height < 2200 || raw.room.height > 3500) throw new Error("Өрөөний хэмжээ буруу байна.");
  if (!Number.isInteger(raw.wallClearance) || raw.wallClearance < 450 || raw.wallClearance > 600 || ![20, 28, 30, 38, 40].includes(raw.countertop.thickness) || !Number.isInteger(raw.countertop.frontOverhang) || raw.countertop.frontOverhang < 0 || raw.countertop.frontOverhang > 100 || !["laminate", "granite", "wood"].includes(raw.countertop.material)) throw new Error("Тавцангийн тохиргоо буруу байна.");
  if (raw.layout !== undefined && !["straight", "l-left", "l-right", "double-side"].includes(raw.layout)) throw new Error("Гал тогооны байрлал буруу байна.");
  const finishes = FINISHES.map(f => f.id), ids = new Set<string>();
  const cabinets = raw.cabinets.map(c => {
    if (!c || typeof c.id !== "string" || !c.id.length || c.id.length > 80 || ids.has(c.id) || !c.position || ![c.position.x, c.position.y, c.position.z, c.position.rotation].every(n => Number.isFinite(n) && Math.abs(n) <= 100000) || typeof c.autoElevation !== "boolean" || typeof c.fitToCeiling !== "boolean") throw new Error("Шүүгээний мэдээлэл буруу байна.");
    ids.add(c.id);
    const error = validateCabinet(c); if (error) throw new Error(error);
    if ((c.finish !== undefined && !finishes.includes(c.finish)) || (c.frontStyle !== undefined && !["flat", "shaker", "glass"].includes(c.frontStyle)) || (c.opening !== undefined && !["doors", "drawers", "open", "sink", "hob", "oven", "hood", "refrigerator"].includes(c.opening))) throw new Error("Хаалганы тохиргоо буруу байна.");
    if ((c.corner !== undefined && typeof c.corner !== "boolean") || (c.cornerSide !== undefined && !["left", "right"].includes(c.cornerSide)) ||
      (c.hoodMount !== undefined && !["under-cabinet", "wall"].includes(c.hoodMount)) || (c.refrigeratorStyle !== undefined && !["top-bottom", "side-by-side"].includes(c.refrigeratorStyle))) throw new Error("Шүүгээний нэмэлт тохиргоо буруу байна.");
    if (c.opening === "sink" && (c.type !== "base" || c.width < 600)) throw new Error("Угаалтуур 600 мм-ээс өргөн доод шүүгээнд байрлана.");
    if (c.variantId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c.variantId)) throw new Error("Шүүгээний 3D variant ID буруу байна.");
    return { id: c.id, ...(c.variantId ? { variantId: c.variantId } : {}), type: c.type, width: c.width, height: c.height, depth: c.depth, doorCount: c.doorCount, drawerCount: c.drawerCount, handleStyle: c.handleStyle, material: c.material, color: c.color,
      position: { x: c.position.x, y: c.position.y, z: c.position.z, rotation: c.position.rotation }, autoElevation: c.autoElevation, fitToCeiling: c.fitToCeiling,
      ...(c.finish ? { finish: c.finish as Finish } : {}), ...(c.frontStyle ? { frontStyle: c.frontStyle as FrontStyle } : {}), ...(c.opening ? { opening: c.opening } : {}),
      ...(c.corner !== undefined ? { corner: c.corner } : {}), ...(c.cornerSide ? { cornerSide: c.cornerSide } : {}),
      ...(c.hoodMount ? { hoodMount: c.hoodMount } : {}), ...(c.refrigeratorStyle ? { refrigeratorStyle: c.refrigeratorStyle } : {}),
      ...(c.components !== undefined ? { components: parseComponents(c) } : {}) };
  });
  if (raw.countertop.finish !== undefined && !finishes.includes(raw.countertop.finish)) throw new Error("Тавцангийн материал буруу байна.");
  if (raw.countertop.color !== undefined && !/^#[0-9a-f]{6}$/i.test(raw.countertop.color)) throw new Error("Тавцангийн өнгө буруу байна.");
  const backsplashSettings = parseBacksplashSettings(raw.backsplashSettings, raw.room);
  const next: ModularKitchen = { version: 1, room: { width: raw.room.width, depth: raw.room.depth, height: raw.room.height }, cabinets, wallClearance: raw.wallClearance,
    countertop: { thickness: raw.countertop.thickness, frontOverhang: raw.countertop.frontOverhang, material: raw.countertop.material,
      ...(raw.countertop.finish ? { finish: raw.countertop.finish } : {}), ...(raw.countertop.color ? { color: raw.countertop.color } : {}) }, backsplash: raw.backsplash === true,
    ...(raw.layout ? { layout: raw.layout } : {}), ...(backsplashSettings ? { backsplashSettings } : {}) };
  const issue = placementIssues(next).find(i => i.severity === "error"); if (issue) throw new Error(issue.message);
  return next;
}
