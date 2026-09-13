export type RoomMaterialPattern =
  | "wood"
  | "laminate"
  | "stone"
  | "ceramic"
  | "terrazzo"
  | "carpet"
  | "linen"
  | "stripes"
  | "botanical"
  | "geometric"
  | "paint"
  | "plaster";

/** Physical repeat sizes are in metres, independent of the room dimensions. */
export interface RoomMaterialDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
  color: string;
  accent: string;
  swatch: string;
  pattern: RoomMaterialPattern;
  tileMetersX: number;
  tileMetersY: number;
  roughness: number;
  normalStrength: number;
}

function woodSwatch(base: string, dark: string): string {
  return `repeating-linear-gradient(0deg,transparent 0 12px,${dark}66 12px 13px),repeating-linear-gradient(3deg,${base} 0 3px,${dark}44 4px,${base} 6px)`;
}

function textileSwatch(base: string, thread: string): string {
  return `repeating-linear-gradient(90deg,transparent 0 2px,${thread}44 2px 3px),repeating-linear-gradient(0deg,${base} 0 2px,${thread}66 2px 3px)`;
}

export const FLOOR_MATERIALS: readonly RoomMaterialDefinition[] = [
  { id: "parquet-birch", label: "Хус", category: "Паркет", description: "Цайвар хус · 90 × 20 см", color: "#d9bc8c", accent: "#a98656", pattern: "wood", tileMetersX: 1.8, tileMetersY: 1.2, roughness: 0.55, normalStrength: 0.48, swatch: woodSwatch("#d9bc8c", "#a98656") },
  { id: "parquet-oak", label: "Царс", category: "Паркет", description: "Байгалийн царс · 90 × 20 см", color: "#b98c59", accent: "#825933", pattern: "wood", tileMetersX: 1.8, tileMetersY: 1.2, roughness: 0.51, normalStrength: 0.5, swatch: woodSwatch("#b98c59", "#825933") },
  { id: "parquet-walnut", label: "Хушга", category: "Паркет", description: "Бараан хушга · 90 × 20 см", color: "#76503a", accent: "#422d23", pattern: "wood", tileMetersX: 1.8, tileMetersY: 1.2, roughness: 0.46, normalStrength: 0.45, swatch: woodSwatch("#76503a", "#422d23") },
  { id: "laminate-ash", label: "Цайвар ламинат", category: "Ламинат", description: "Үнсэн саарал мод · 120 × 20 см", color: "#c9c0ac", accent: "#968d7b", pattern: "laminate", tileMetersX: 2.4, tileMetersY: 1.2, roughness: 0.42, normalStrength: 0.23, swatch: woodSwatch("#c9c0ac", "#968d7b") },
  { id: "laminate-smoked", label: "Бараан ламинат", category: "Ламинат", description: "Утсан царс · 120 × 20 см", color: "#74685c", accent: "#473f38", pattern: "laminate", tileMetersX: 2.4, tileMetersY: 1.2, roughness: 0.44, normalStrength: 0.23, swatch: woodSwatch("#74685c", "#473f38") },
  { id: "tile-limestone", label: "Шохойн чулуу", category: "Плита", description: "Дулаан чулуун хээ · 60 × 60 см", color: "#c4bcaa", accent: "#938a78", pattern: "stone", tileMetersX: 1.2, tileMetersY: 1.2, roughness: 0.68, normalStrength: 0.65, swatch: "repeating-linear-gradient(90deg,transparent 0 27px,#948c7c 27px 29px),repeating-linear-gradient(0deg,#c4bcaa 0 27px,#948c7c 27px 29px)" },
  { id: "tile-ceramic", label: "Цагаан керамик", category: "Плита", description: "Гөлгөр цагаан плита · 60 × 60 см", color: "#e3dfd6", accent: "#aaa496", pattern: "ceramic", tileMetersX: 1.2, tileMetersY: 1.2, roughness: 0.24, normalStrength: 0.55, swatch: "repeating-linear-gradient(90deg,transparent 0 27px,#b4ad9f 27px 28px),repeating-linear-gradient(0deg,#e3dfd6 0 27px,#b4ad9f 27px 28px)" },
  { id: "tile-terrazzo", label: "Терраццо", category: "Плита", description: "Чулуун үйрмэгтэй · 60 × 60 см", color: "#d7d0bf", accent: "#877764", pattern: "terrazzo", tileMetersX: 1.2, tileMetersY: 1.2, roughness: 0.43, normalStrength: 0.55, swatch: "radial-gradient(ellipse at 20% 30%,#918474 0 3px,transparent 4px),radial-gradient(ellipse at 65% 70%,#b69b82 0 4px,transparent 5px),radial-gradient(ellipse at 80% 15%,#f0e9dc 0 4px,transparent 5px),#d7d0bf" },
  { id: "carpet-sand", label: "Элсэн хивс", category: "Хивс", description: "Зөөлөн нэхмэл · дулаан шаргал", color: "#b8a48a", accent: "#887661", pattern: "carpet", tileMetersX: 0.5, tileMetersY: 0.5, roughness: 0.97, normalStrength: 0.85, swatch: textileSwatch("#b8a48a", "#887661") },
  { id: "carpet-grey", label: "Саарал хивс", category: "Хивс", description: "Зөөлөн нэхмэл · чулуун саарал", color: "#929791", accent: "#636b66", pattern: "carpet", tileMetersX: 0.5, tileMetersY: 0.5, roughness: 0.98, normalStrength: 0.85, swatch: textileSwatch("#929791", "#636b66") },
];

export const WALLPAPER_MATERIALS: readonly RoomMaterialDefinition[] = [
  { id: "wallpaper-linen", label: "Маалинган", category: "Ханын цаас", description: "Байгалийн маалинган нэхээс", color: "#d8ceba", accent: "#a69b85", pattern: "linen", tileMetersX: 0.53, tileMetersY: 0.53, roughness: 0.91, normalStrength: 0.35, swatch: textileSwatch("#d8ceba", "#a69b85") },
  { id: "wallpaper-stripes", label: "Судалтай", category: "Ханын цаас", description: "Дулаан цагаан, шаргал босоо судал", color: "#eee8db", accent: "#c0b398", pattern: "stripes", tileMetersX: 0.53, tileMetersY: 0.53, roughness: 0.87, normalStrength: 0.16, swatch: "repeating-linear-gradient(90deg,#eee8db 0 12px,#c0b398 12px 24px)" },
  { id: "wallpaper-botanical", label: "Навчин хээ", category: "Ханын цаас", description: "Зөөлөн ногоон навчтай хээ", color: "#e6e6d9", accent: "#83957b", pattern: "botanical", tileMetersX: 0.53, tileMetersY: 0.64, roughness: 0.88, normalStrength: 0.14, swatch: "radial-gradient(ellipse at 32% 32%,#83957b 0 6px,transparent 7px),radial-gradient(ellipse at 63% 67%,#a3ad92 0 8px,transparent 9px),linear-gradient(60deg,transparent 48%,#83957b 49% 51%,transparent 52%),#e6e6d9" },
  { id: "wallpaper-geometric", label: "Геометр хээ", category: "Ханын цаас", description: "Нарийн зураастай ромбон хээ", color: "#e7e1d5", accent: "#aa9275", pattern: "geometric", tileMetersX: 0.53, tileMetersY: 0.53, roughness: 0.84, normalStrength: 0.14, swatch: "repeating-linear-gradient(45deg,transparent 0 14px,#aa9275 14px 15px,transparent 15px 29px),repeating-linear-gradient(-45deg,#e7e1d5 0 14px,#aa9275 14px 15px,#e7e1d5 15px 29px)" },
];

export const CEILING_MATERIALS: readonly RoomMaterialDefinition[] = [
  { id: "ceiling-white", label: "Цагаан", category: "Тааз", description: "Матт цагаан будаг", color: "#f3f1eb", accent: "#e0ded8", pattern: "paint", tileMetersX: 0.6, tileMetersY: 0.6, roughness: 0.9, normalStrength: 0.08, swatch: "linear-gradient(135deg,#fffef9,#eae8e0)" },
  { id: "ceiling-plaster", label: "Шавардлага", category: "Тааз", description: "Зөөлөн барзгар шавардлага", color: "#e5e0d4", accent: "#bab3a3", pattern: "plaster", tileMetersX: 0.6, tileMetersY: 0.6, roughness: 0.96, normalStrength: 0.65, swatch: "radial-gradient(ellipse at 20% 30%,#cfc8b8 0 1px,transparent 2px),repeating-linear-gradient(23deg,#e5e0d4 0 3px,#d8d1c3 4px,#e5e0d4 6px)" },
];

export const ROOM_MATERIALS: readonly RoomMaterialDefinition[] = [
  ...FLOOR_MATERIALS,
  ...WALLPAPER_MATERIALS,
  ...CEILING_MATERIALS,
];

const materialsById = new Map(ROOM_MATERIALS.map((material) => [material.id, material]));

export function getRoomMaterial(materialId?: string): RoomMaterialDefinition | undefined {
  return materialId ? materialsById.get(materialId) : undefined;
}
