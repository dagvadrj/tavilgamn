import type { KitchenOpening } from "./kitchenModuleCatalog";

export function cabinetModuleCode(type: "base" | "wall" | "tall" | "corner", widthMm: number, heightMm: number, depthMm: number) {
  if (![widthMm, heightMm, depthMm].every(value => Number.isSafeInteger(value) && value > 0 && value <= 5000)) throw new Error("Module хэмжээ 1–5000 мм бүхэл тоо байна.");
  const prefix = type === "corner" ? "CORNER-BASE" : type.toUpperCase();
  const standardHeight = type === "wall" ? 720 : type === "tall" ? 2600 : 840;
  const standardDepth = type === "wall" ? 350 : 600;
  return `${prefix}-${widthMm}${heightMm === standardHeight && depthMm === standardDepth ? "" : `-H${heightMm}-D${depthMm}`}`;
}
export function cabinetVariantCode(moduleCode: string, opening: KitchenOpening, doors: number, drawers: number, designCode = "") {
  if (!/^(?:BASE|WALL|TALL|CORNER-BASE)-[0-9]+(?:-H[0-9]+-D[0-9]+)?$/.test(moduleCode)) throw new Error("Canonical module code буруу байна.");
  if (!Number.isSafeInteger(doors) || !Number.isSafeInteger(drawers) || doors < 0 || doors > 4 || drawers < 0 || drawers > 4) throw new Error("Хаалга/шургуулгын тоо 0–4 байна.");
  const suffix = opening === "doors" ? `${doors}-${doors === 1 ? "DOOR" : "DOORS"}`
    : opening === "drawers" && doors ? `${doors}-${doors === 1 ? "DOOR" : "DOORS"}-${drawers}-${drawers === 1 ? "DRAWER" : "DRAWERS"}`
    : opening === "drawers" ? `${drawers}-${drawers === 1 ? "DRAWER" : "DRAWERS"}` : opening.toUpperCase();
  if (designCode && !/^[A-Z0-9]{1,16}(?:-[A-Z0-9]{1,16}){0,3}$/.test(designCode)) throw new Error("Хийцийн code нь TOP144 зэрэг uppercase ASCII байна.");
  const result = `${moduleCode}-${suffix}${designCode ? `-${designCode}` : ""}`;
  if (result.length > 80) throw new Error("Variant code 80 тэмдэгтээс ихгүй байна.");
  return result;
}
