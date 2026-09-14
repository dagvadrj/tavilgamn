import type { ModularCabinet } from "./kitchenCabinets";

/** Authored planning geometry in mm, shared by validation and the renderer. */
export const OVEN_BODY = { width: 560, height: 590, depth: 540 };
/** Authored planning presets, not manufacturer installation specifications. */
export const COOKTOP_PRESETS = [
  { id: "300", label: "30 см · 290 × 520 мм", width: 290, height: 46, depth: 520, cutoutWidth: 270, cutoutDepth: 490, minWidth: 400 },
  { id: "600", label: "60 см · 590 × 520 мм", width: 590, height: 46, depth: 520, cutoutWidth: 560, cutoutDepth: 490, minWidth: 600 },
  { id: "800", label: "80 см · 780 × 520 мм", width: 780, height: 46, depth: 520, cutoutWidth: 750, cutoutDepth: 490, minWidth: 800 },
] as const;
export function cooktopGeometry(c: ModularCabinet, model = c.components?.find(item => item.type === "cooktop")?.model ?? "induction") {
  return COOKTOP_PRESETS.find(preset => model.endsWith(`-${preset.id}`))
    ?? { width: 520, height: 46, depth: 440, cutoutWidth: 500, cutoutDepth: 400, minWidth: 600 };
}
export const hasCooktop = (c: ModularCabinet) => c.type === "base" && (c.opening === "hob" || c.opening === "oven");
export function ovenSlot(c: ModularCabinet) {
  if (c.opening !== "oven" || c.type === "wall") return null;
  const bottom = c.type === "base" ? c.height - 680 : 900;
  return { width: c.width - 36, height: 600, depth: c.depth - 36, bottom, top: bottom + 600,
    // Body sits behind the appliance's own front, clear of the carcass back.
    x: 0, y: bottom + 5 + OVEN_BODY.height / 2, z: c.depth / 2 - 18 - OVEN_BODY.depth / 2 };
}
export function applianceIssue(c: ModularCabinet): string | null {
  if (c.opening === "sink" && (c.type !== "base" || c.width < 600))
    return "Угаалтуур, плитка 600 мм-ээс багагүй өргөнтэй доод шүүгээнд байрлана.";
  if (c.opening === "hob" && c.type !== "base") return "Плитка доод шүүгээний тавцанд байрлана.";
  if (hasCooktop(c)) {
    const hob = cooktopGeometry(c);
    if (c.width < hob.minWidth || hob.cutoutWidth > c.width - 36 || hob.depth > c.depth - 20)
      return "Плитканы хэмжээ шүүгээний дотор болон тавцангийн гүнд багтахгүй байна.";
  }
  if (c.opening === "hood") {
    if (c.type !== "wall" || !["under-cabinet", "wall"].includes(c.hoodMount ?? "") || c.width < 600 || c.drawerCount !== 0 || c.corner)
      return "Утаа сорогчид 600 мм-ээс багагүй өргөнтэй дээд байрлал, угсралтын төрөл сонгоно уу.";
    return null;
  }
  if (c.opening === "refrigerator") {
    if (c.type !== "tall" || !["top-bottom", "side-by-side"].includes(c.refrigeratorStyle ?? "") || c.drawerCount !== 0 || c.fitToCeiling || c.corner)
      return "Хөргөгчийн хаалганы төрөл, бодит хэмжээг сонгоно уу. Өндөр нь тааз дагахгүй.";
    return null;
  }
  if (c.opening !== "oven") return null;
  const slot = ovenSlot(c);
  if (!slot || c.width !== 600 || c.depth < 580 || c.drawerCount !== 0)
    return "Зууханд 600 мм өргөн, 580 мм-ээс багагүй гүнтэй, шургуулгагүй доод эсвэл өндөр шүүгээний зориулалтын нүх хэрэгтэй.";
  if (slot.width < OVEN_BODY.width || slot.depth < OVEN_BODY.depth || slot.height < OVEN_BODY.height || slot.bottom < 98 || slot.top + 18 > c.height)
    return "Зуух шүүгээний дотоод бүтэцтэй давхцаж байна. Нүхний хэмжээг шалгана уу.";
  // Cut-in hob body ends 15 mm below the carcass top; leave a clear vertical gap.
  if (hasCooktop(c) && slot.y + OVEN_BODY.height / 2 >= c.height - 15)
    return "Плитка болон зуухны их бие давхцаж байна.";
  return null;
}
export function cabinetFrontExtra(c: ModularCabinet) {
  // Standalone appliance dimensions include their doors and handles.
  if (c.opening === "refrigerator" || (c.opening === "hood" && c.hoodMount === "wall")) return 0;
  if (c.opening === "oven" && c.type === "base") return 22;
  const handle = c.opening === "open" || c.handleStyle === "push-open" ? 0 : c.handleStyle === "knob" ? 31 : 22;
  return Math.max(handle, c.opening === "oven" ? 22 : 0);
}
