import type { KitchenOpening } from "./kitchenModuleCatalog";

export function cabinetModuleCode(type: "base" | "wall" | "tall" | "corner", widthMm: number, heightMm: number, depthMm: number) {
  if (![widthMm, heightMm, depthMm].every(value => Number.isSafeInteger(value) && value > 0 && value <= 5000)) throw new Error("Module хэмжээ 1–5000 мм бүхэл тоо байна.");
  const prefix = type === "corner" ? "CORNER-BASE" : type.toUpperCase();
  const standardHeight = type === "wall" ? 720 : type === "tall" ? 2600 : 840;
  const standardDepth = type === "wall" ? 350 : 600;
  return `${prefix}-${widthMm}${heightMm === standardHeight && depthMm === standardDepth ? "" : `-H${heightMm}-D${depthMm}`}`;
}
/** Module families an admin may create from a measured GLB. Ranges are in mm.
 *  height/depth 0 = the family always spells out -H…-D… (matches existing seed codes). */
export const KITCHEN_MODULE_FAMILIES = {
  base: { prefix: "BASE", cabinetType: "base", label: "Доод шүүгээ", height: 840, depth: 600, range: { w: [150, 1200], h: [700, 950], d: [300, 700] } },
  wall: { prefix: "WALL", cabinetType: "wall", label: "Дээд шүүгээ", height: 720, depth: 350, range: { w: [150, 1200], h: [250, 1200], d: [250, 450] } },
  tall: { prefix: "TALL", cabinetType: "tall", label: "Өндөр шүүгээ", height: 2600, depth: 600, range: { w: [300, 1200], h: [1400, 3000], d: [300, 700] } },
  corner: { prefix: "CORNER-BASE", cabinetType: "corner", label: "Булангийн доод шүүгээ", height: 840, depth: 600, range: { w: [600, 1300], h: [700, 950], d: [500, 1300] } },
  "corner-wall": { prefix: "CORNER-WALL", cabinetType: "wall", label: "Булангийн дээд шүүгээ", height: 720, depth: 350, range: { w: [300, 1000], h: [250, 1200], d: [250, 1000] } },
  "over-fridge": { prefix: "FRIDGE-WALL", cabinetType: "wall", label: "Хөргөгчний дээд шүүгээ", height: 0, depth: 0, range: { w: [450, 1200], h: [200, 900], d: [300, 700] } },
  island: { prefix: "ISLAND", cabinetType: "base", label: "Гал тогооны арал", height: 0, depth: 0, range: { w: [600, 3000], h: [700, 1100], d: [500, 1500] } },
} as const;
export type KitchenModuleFamily = keyof typeof KITCHEN_MODULE_FAMILIES;

export function kitchenModuleDefinition(family: KitchenModuleFamily, widthMm: number, heightMm: number, depthMm: number) {
  const spec = KITCHEN_MODULE_FAMILIES[family];
  if (!spec) throw new Error("Module-ийн төрөл буруу байна.");
  const sizes = [widthMm, heightMm, depthMm];
  if (!sizes.every(Number.isSafeInteger)) throw new Error("Module хэмжээ бүхэл мм байна.");
  const [w, h, d] = [spec.range.w, spec.range.h, spec.range.d];
  if (widthMm < w[0] || widthMm > w[1] || heightMm < h[0] || heightMm > h[1] || depthMm < d[0] || depthMm > d[1])
    throw new Error(`${spec.label}: өргөн ${w.join("–")}, өндөр ${h.join("–")}, гүн ${d.join("–")} мм байна.`);
  const standard = heightMm === spec.height && depthMm === spec.depth;
  return {
    code: `${spec.prefix}-${widthMm}${standard ? "" : `-H${heightMm}-D${depthMm}`}`,
    name: `${widthMm} мм ${spec.label.toLowerCase()}${standard ? "" : ` · ${heightMm}×${depthMm}`}`,
    cabinetType: spec.cabinetType,
    widthMm, heightMm, depthMm,
  };
}
export function cabinetVariantCode(moduleCode: string, opening: KitchenOpening, doors: number, drawers: number, designCode = "") {
  if (!/^(?:BASE|WALL|TALL|CORNER-BASE|CORNER-WALL|FRIDGE-WALL|ISLAND)-[0-9]+(?:-H[0-9]+-D[0-9]+)?$/.test(moduleCode)) throw new Error("Canonical module code буруу байна.");
  if (!Number.isSafeInteger(doors) || !Number.isSafeInteger(drawers) || doors < 0 || doors > 4 || drawers < 0 || drawers > 4) throw new Error("Хаалга/шургуулгын тоо 0–4 байна.");
  const suffix = opening === "doors" ? `${doors}-${doors === 1 ? "DOOR" : "DOORS"}`
    : opening === "drawers" && doors ? `${doors}-${doors === 1 ? "DOOR" : "DOORS"}-${drawers}-${drawers === 1 ? "DRAWER" : "DRAWERS"}`
    : opening === "drawers" ? `${drawers}-${drawers === 1 ? "DRAWER" : "DRAWERS"}` : opening.toUpperCase();
  if (designCode && !/^[A-Z0-9]{1,16}(?:-[A-Z0-9]{1,16}){0,3}$/.test(designCode)) throw new Error("Хийцийн code нь TOP144 зэрэг uppercase ASCII байна.");
  const result = `${moduleCode}-${suffix}${designCode ? `-${designCode}` : ""}`;
  if (result.length > 80) throw new Error("Variant code 80 тэмдэгтээс ихгүй байна.");
  return result;
}
