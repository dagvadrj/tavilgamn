import { FINISHES, type Finish } from "./kitchen";
import type { ModularCabinet, ModularKitchen } from "./kitchenCabinets";
import { applianceIssue, hasCooktop } from "./kitchenAppliances";
import { placementIssues } from "./kitchenPlacement";

export type ComponentType = "sink" | "tap" | "oven" | "cooktop" | "door-front" | "drawer-front" | "handle" | "worktop" | "plinth" | "frame";
/** Optional per-component overrides. Mounts/dimensions are derived, never arbitrary poses. */
export type ComponentFinish = Finish | "steel" | "brass" | "ceramic" | "granite" | "matte-metal";
export interface ComponentSize { width?: number; height?: number; depth?: number }
export interface CabinetComponent { type: ComponentType; model: string; color?: string; finish?: ComponentFinish; size?: ComponentSize }
export interface ComponentOption { type: ComponentType; model: string; label: string; minWidth?: number; width?: number; minDepth?: number }
const boardMaterials = FINISHES.map(f => ({ id: f.id, label: f.name, color: f.color }));
const metalMaterials = [
  { id: "steel", label: "Зэвэрдэггүй ган", color: "#aeb5b3" },
  { id: "brass", label: "Гуулин", color: "#b29a61" },
  { id: "matte-metal", label: "Матт металл", color: "#303835" },
] as const;
export function componentMaterials(type: ComponentType): readonly { id: ComponentFinish; label: string; color: string }[] {
  if (type === "sink") return [metalMaterials[0], { id: "ceramic", label: "Керамик", color: "#f2eee5" }, { id: "granite", label: "Чулуун нийлмэл", color: "#4c514c" }];
  if (type === "tap" || type === "handle") return metalMaterials;
  return ["door-front", "drawer-front", "worktop", "plinth", "frame"].includes(type) ? boardMaterials : [];
}
export function componentSurface(item: CabinetComponent) {
  const board = FINISHES.find(f => f.id === item.finish);
  if (board) return { roughness: board.roughness, metalness: 0 };
  return { roughness: item.finish === "ceramic" ? .2 : item.finish === "granite" ? .88 : item.finish === "matte-metal" ? .65 : .28,
    metalness: ["steel", "brass", "matte-metal"].includes(item.finish ?? "") ? .85 : 0 };
}
export function getComponentSize(c: ModularCabinet, item: CabinetComponent, kitchen?: ModularKitchen): Required<ComponentSize> {
  const toe = c.type === "base" ? 80 : 0, drawers = c.opening === "drawers" ? Math.max(1, c.drawerCount) : c.drawerCount;
  const drawerHeight = c.opening === "drawers" ? (c.height - toe) / drawers : 120;
  const sizes: Record<ComponentType, Required<ComponentSize>> = {
    sink: { width: 440, height: 150, depth: 340 }, tap: { width: 22, height: 260, depth: 160 },
    oven: { width: 560, height: 590, depth: 540 }, cooktop: { width: 520, height: 46, depth: 440 },
    "door-front": { width: c.width / c.doorCount - 4, height: c.height - toe - drawerHeight * drawers - 4, depth: 18 },
    "drawer-front": { width: c.width - 4, height: drawerHeight - 4, depth: 18 },
    handle: item.model === "knob" ? { width: 30, height: 30, depth: 30 } : item.model === "push-open" ? { width: 0, height: 0, depth: 0 }
      : { width: Math.min(140, (c.width / c.doorCount - 4) * .5), height: 14, depth: 22 },
    worktop: { width: c.width, height: kitchen?.countertop.thickness ?? 30, depth: c.depth + (kitchen?.countertop.frontOverhang ?? 20) },
    plinth: { width: c.width - 40, height: 80, depth: c.depth - 90 }, frame: { width: c.width, height: c.height, depth: c.depth },
  };
  if (c.type === "tall" && c.opening === "oven" && item.type === "door-front") sizes["door-front"].height = Math.max(882, c.height - 1518) - 4;
  return { ...sizes[item.type], ...item.size };
}
export function componentSizeFields(c: ModularCabinet, item: CabinetComponent): { key: keyof ComponentSize; label: string; min: number; max: number }[] {
  if (item.type === "sink") return [
    { key: "width", label: "Угаалтуурын өргөн", min: 320, max: c.width - 80 },
    { key: "depth", label: "Угаалтуурын гүн", min: 260, max: Math.min(400, c.depth - 180) },
    { key: "height", label: "Аяганы өндөр", min: 120, max: 220 },
  ];
  if (item.type === "tap") return [
    { key: "height", label: "Цоргоны өндөр", min: 180, max: 350 },
    { key: "depth", label: "Цоргоны хошууны урт", min: 120, max: 200 },
  ];
  if (item.type === "handle" && item.model === "bar") return [{ key: "width", label: "Бариулын урт", min: 80, max: Math.min(220, c.width / c.doorCount - 64) }];
  return [];
}
function componentSizeIssue(c: ModularCabinet, item: CabinetComponent): string | undefined {
  if (item.size === undefined) return;
  if (!item.size || typeof item.size !== "object" || Array.isArray(item.size)) return "Хэсгийн хэмжээ буруу байна.";
  const fields = componentSizeFields(c, item);
  for (const [key, value] of Object.entries(item.size)) {
    const field = fields.find(field => field.key === key);
    if (!field || !Number.isInteger(value) || value! < field.min || value! > field.max)
      return field ? `${field.label}: ${field.min}–${field.max} мм байна.` : "Энэ хэсгийн хэмжээ угсрах нүхээр тогтоогдоно.";
  }
}
export const COMPONENT_LABELS: Record<ComponentType, string> = {
  sink: "Угаалтуур", tap: "Холигч цорго", oven: "Зуух", cooktop: "Плитка", "door-front": "Хаалганы навч",
  "drawer-front": "Шургуулганы нүүр", handle: "Бариул", worktop: "Тавцан", plinth: "Хөл, суурь", frame: "Дотоод бүтэц",
};
export const COMPONENT_OPTIONS: ComponentOption[] = [
  { type: "sink", model: "single", label: "Нэг тасалгаатай", minWidth: 600 },
  { type: "sink", model: "double", label: "Хоёр тасалгаатай", minWidth: 600 },
  { type: "tap", model: "square", label: "Шулуун цорго", minWidth: 600 },
  { type: "tap", model: "angled", label: "Налуу цорго", minWidth: 600 },
  { type: "oven", model: "black", label: "Хар шилэн зуух", width: 600, minDepth: 580 },
  { type: "oven", model: "steel", label: "Ган хүрээтэй зуух", width: 600, minDepth: 580 },
  { type: "cooktop", model: "induction", label: "Индукцийн плитка", minWidth: 600 },
  { type: "cooktop", model: "ceramic", label: "Керамик плитка", minWidth: 600 },
  ...(["door-front", "drawer-front"] as const).flatMap(type => [
    { type, model: "flat", label: "Хавтгай" }, { type, model: "shaker", label: "Хүрээтэй" }, { type, model: "glass", label: "Шилэн" }]),
  { type: "handle", model: "bar", label: "Урт бариул" }, { type: "handle", model: "knob", label: "Товчин бариул" }, { type: "handle", model: "push-open", label: "Дарж нээх" },
  ...FINISHES.map(f => ({ type: "worktop" as const, model: f.id, label: f.name })),
  { type: "plinth", model: "recessed", label: "Ухраасан суурь" },
  { type: "plinth", model: "legs", label: "Ил хөлтэй" },
  { type: "frame", model: "standard", label: "18 мм хавтан" },
];
export function componentTypes(c: ModularCabinet): ComponentType[] {
  const types: ComponentType[] = [];
  if (c.opening === "sink") types.push("sink", "tap");
  if (c.opening === "oven") types.push("oven");
  if (hasCooktop(c)) types.push("cooktop");
  if (c.opening !== "open" && !(c.opening === "oven" && c.type === "base") && c.opening !== "drawers") types.push("door-front");
  if (c.drawerCount > 0) types.push("drawer-front");
  if (types.includes("door-front") || types.includes("drawer-front")) types.push("handle");
  if (c.type === "base") types.push("worktop", "plinth");
  types.push("frame");
  return types;
}
export function compatibleOptions(c: ModularCabinet, type: ComponentType) {
  if (!componentTypes(c).includes(type)) return [];
  return COMPONENT_OPTIONS.filter(o => o.type === type && (!o.width || o.width === c.width) &&
    (!o.minWidth || c.width >= o.minWidth) && (!o.minDepth || c.depth >= o.minDepth) &&
    !componentSizeIssue(c, compatibleReplacement(c, { ...c.components?.find(item => item.type === type), type, model: o.model })));
}
export function getComponents(c: ModularCabinet, kitchen?: ModularKitchen): CabinetComponent[] {
  return componentTypes(c).map(type => {
    const defaults: Record<ComponentType, string> = { sink: "single", tap: "square", oven: "black", cooktop: "induction",
      "door-front": c.frontStyle ?? "flat", "drawer-front": c.frontStyle ?? "flat", handle: c.handleStyle,
      worktop: kitchen?.countertop.finish ?? "matte", plinth: "recessed", frame: "standard" };
    const override = c.components?.find(item => item.type === type);
    const woodFinish = c.finish ?? (c.material === "wood" ? "oak" : c.material === "gloss" ? "gloss" : "matte");
    const finish: ComponentFinish | undefined = ["door-front", "drawer-front", "frame"].includes(type) ? woodFinish
      : type === "worktop" ? (override?.model ?? defaults.worktop) as Finish : ["sink", "tap", "handle"].includes(type) ? "steel" : type === "plinth" ? "matte" : undefined;
    const color = ["door-front", "drawer-front"].includes(type) ? c.color : undefined;
    return { type, model: defaults[type], ...(finish ? { finish } : {}), ...(color ? { color } : {}), ...override };
  });
}
export function componentColor(c: ModularCabinet, item: CabinetComponent) {
  if (item.color) return item.color;
  if (item.finish && c.components?.find(part => part.type === item.type)?.finish) {
    const material = componentMaterials(item.type).find(material => material.id === item.finish);
    if (material) return material.color;
  }
  switch (item.type) {
    case "oven": return item.model === "steel" ? "#aeb5b3" : "#202726";
    case "cooktop": return "#191d20";
    case "tap": return "#3d413c";
    case "sink": return "#929d9f";
    case "handle": return item.model === "knob" ? "#8e7b54" : "#3d413c";
    case "plinth": return "#5c6057";
    case "worktop": return FINISHES.find(f => f.id === item.model)?.color ?? "#ffffff";
    default: return c.color;
  }
}
export function parseComponents(c: ModularCabinet): CabinetComponent[] {
  if (!Array.isArray(c.components) || c.components.length > 10) throw new Error("Бүрэлдэхүүн хэсгийн мэдээлэл буруу байна.");
  const seen = new Set<string>();
  return c.components.map(item => {
    if (item) { const error = componentSizeIssue(c, item); if (error) throw new Error(error); }
    if (!item || seen.has(item.type) || !compatibleOptions(c, item.type).some(o => o.model === item.model) ||
      (item.color !== undefined && !/^#[0-9a-f]{6}$/i.test(item.color))) throw new Error("Энэ бүрэлдэхүүн хэсэг шүүгээний төрөл, хэмжээтэй тохирохгүй байна.");
    seen.add(item.type);
    if (item.finish !== undefined && !componentMaterials(item.type).some(material => material.id === item.finish)) throw new Error("Энэ хэсэгт тохирохгүй материал байна.");
    return { type: item.type, model: item.model, ...(item.color !== undefined ? { color: item.color } : {}),
      ...(item.finish !== undefined ? { finish: item.finish } : {}), ...(item.size !== undefined ? { size: { ...item.size } } : {}) };
  });
}
export function withOpening(c: ModularCabinet, opening: ModularCabinet["opening"]): ModularCabinet {
  const next = { ...c, opening, drawerCount: opening === "drawers" ? 3 : 0 };
  return { ...next, ...(c.components ? { components: c.components.filter(item => componentTypes(next).includes(item.type)) } : {}) };
}
/** Atomic replacement/snap: invalid type, slot or collision leaves the original design intact. */
export function replaceComponent(kitchen: ModularKitchen, id: string, item: CabinetComponent): { kitchen: ModularKitchen; error?: string } {
  const c = kitchen.cabinets.find(cabinet => cabinet.id === id);
  if (!c || !compatibleOptions(c, item.type).some(o => o.model === item.model))
    return { kitchen, error: "Зориулалтын нүх, төрөл эсвэл хэмжээ тохирохгүй тул байрлуулсангүй." };
  const current = c.components?.find(part => part.type === item.type);
  item = compatibleReplacement(c, { ...current, ...item });
  if (item.type === "worktop") {
    const previousModel = current?.model ?? kitchen.countertop.finish ?? "matte";
    const material = item.model !== previousModel ? item.model : item.finish ?? item.model;
    item = { ...item, model: material, finish: material as Finish };
  }
  let updated: ModularCabinet = { ...c, components: [...(c.components ?? []).filter(o => o.type !== item.type), item] };
  if (item.type === "handle") updated = { ...updated, handleStyle: item.model as ModularCabinet["handleStyle"] };
  try { updated.components = parseComponents(updated); } catch (error) { return { kitchen, error: (error as Error).message }; }
  const next = { ...kitchen, cabinets: kitchen.cabinets.map(cabinet => cabinet.id === id ? updated : cabinet) };
  const error = applianceIssue(updated) || placementIssues(next).find(i => i.severity === "error")?.message;
  return error ? { kitchen, error } : { kitchen: next };
}
export const snapAppliance = (kitchen: ModularKitchen, id: string, appliance: CabinetComponent & { type: "oven" | "cooktop" }) => replaceComponent(kitchen, id, appliance);

/** Keep shared dimensional settings; remove only fields absent on a different mount model. */
export function compatibleReplacement(c: ModularCabinet, item: CabinetComponent): CabinetComponent {
  const previous = c.components?.find(part => part.type === item.type);
  if (!previous || previous.model === item.model || !item.size || typeof item.size !== "object" || Array.isArray(item.size)) return item;
  const keys = componentSizeFields(c, item).map(field => field.key);
  return { ...item, size: Object.fromEntries(Object.entries(item.size).filter(([key]) => keys.includes(key as keyof ComponentSize))) };
}
