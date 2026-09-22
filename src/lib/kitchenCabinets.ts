/** Modular kitchen v1. All dimensions/positions are millimetres; yaw is radians.
 * Position is the footprint centre and cabinet bottom. Local +Z is the front.
 * The old run-based Kitchen type remains supported by the existing configurator.
 */
import { applianceIssue } from "./plitka";
import type { CabinetComponent } from "./kitchenComponents";
import type { Finish, FrontStyle } from "./kitchen";
export const CABINET_WIDTHS = [300, 400, 450, 500, 600, 700, 800, 900] as const;
export const BASE_CABINET_WIDTHS = [...CABINET_WIDTHS, 1000] as const;
export const cabinetWidths = (type: CabinetType) => type === "base" ? BASE_CABINET_WIDTHS : CABINET_WIDTHS;
/** Cabinet presets stay discrete; appliances retain their measured integer footprint. */
export type CabinetWidth = number;
export type CabinetType = "base" | "wall" | "tall";
export type KitchenLayout = "straight" | "l-right" | "l-left" | "double-side";
export type HoodMount = "under-cabinet" | "wall";
export type RefrigeratorStyle = "top-bottom" | "side-by-side";
export type CabinetHandle = "bar" | "knob" | "push-open";
export type CabinetMaterial = "matte" | "wood" | "gloss";
export type Point2 = { x: number; z: number };
export type CabinetPose = Point2 & { y: number; rotation: number };
export interface ModularCabinet {
  id: string;
  /** Optional furniture_models-backed kitchen variant; dimensions remain authored here in mm. */
  variantId?: string;
  type: CabinetType;
  width: CabinetWidth;
  height: number;
  depth: number;
  doorCount: 1 | 2;
  drawerCount: number;
  handleStyle: CabinetHandle;
  color: string;
  material: CabinetMaterial;
  position: CabinetPose;
  autoElevation: boolean;
  fitToCeiling: boolean;
  finish?: Finish;
  frontStyle?: FrontStyle;
  opening?: "doors" | "drawers" | "open" | "sink" | "hob" | "oven" | "hood" | "refrigerator";
  hoodMount?: HoodMount;
  refrigeratorStyle?: RefrigeratorStyle;
  corner?: boolean;
  cornerSide?: "left" | "right";
  components?: CabinetComponent[];
}
export interface KitchenRoom { width: number; depth: number; height: number }
export interface KitchenWall { id: string; start: Point2; end: Point2; inward: Point2 }
export interface CountertopSettings { thickness: number; frontOverhang: number; material: "laminate" | "granite" | "wood"; finish?: Finish; color?: string }
export interface Countertop extends CountertopSettings {
  id: string; cabinetIds: string[]; width: number; depth: number; position: CabinetPose;
}
export interface ModularKitchen {
  version: 1; room: KitchenRoom; cabinets: ModularCabinet[];
  layout?: KitchenLayout;
  wallClearance: number; countertop: CountertopSettings;
  backsplash?: boolean;

  backsplashSettings?: { mode: "full-run" | "manual"; panels: { id: string; width: number; height: number; thickness: number; position: CabinetPose }[] };
}
export const CABINET_DEFAULTS = {
  base: { label: "Доод шүүгээ", height: 820, depth: 600, heightRange: [800, 900], depthRange: [550, 650] },
  wall: { label: "Дээд шүүгээ", height: 720, depth: 350, heightRange: [400, 1200], depthRange: [250, 450] },
  tall: { label: "Өндөр шүүгээ", height: 2600, depth: 600, heightRange: [1800, 3500], depthRange: [550, 650] },
} as const;
export const REFRIGERATOR_PRESETS = {
  "top-bottom": { label: "Дээр, доор хаалгатай", width: 600, height: 1850, depth: 650 },
  "side-by-side": { label: "Зэрэгцээ хоёр том хаалгатай", width: 900, height: 1800, depth: 700 },
} as const;
export const REFRIGERATOR_LIMITS = { width: [450, 1200], height: [1400, 2300], depth: [500, 900] } as const;
export const HOOD_MOUNTS = [
  { id: "under-cabinet", label: "Шүүгээний доор" }, { id: "wall", label: "Шууд хананд" },
] as const;
export function cabinetLabel(cabinet: ModularCabinet) {
  if (cabinet.opening === "refrigerator") return "Хөргөгч";
  if (cabinet.opening === "hood") return cabinet.hoodMount === "wall" ? "Утаа сорогч" : "Утаа сорогчтой дээд шүүгээ";
  if (cabinet.corner) return cabinet.type === "wall" ? "Дээд булангийн шүүгээ" : "Доод булангийн шүүгээ";
  return CABINET_DEFAULTS[cabinet.type].label;
}
export function createCabinet(type: CabinetType, id: string, width: CabinetWidth = 600, ceiling = 2600): ModularCabinet {
  return { id, type, width, height: type === "tall" ? ceiling : CABINET_DEFAULTS[type].height,
    depth: CABINET_DEFAULTS[type].depth, doorCount: width >= 600 ? 2 : 1, drawerCount: 0,
    handleStyle: "bar", color: type === "wall" ? "#ece8df" : "#b99165", material: type === "wall" ? "matte" : "wood",
    position: { x: width / 2, y: type === "wall" ? 1400 : 0, z: CABINET_DEFAULTS[type].depth / 2, rotation: 0 },
    autoElevation: type === "wall", fitToCeiling: type === "tall" };
}
export function createRefrigerator(id: string, style: RefrigeratorStyle = "top-bottom"): ModularCabinet {
  const { width, height, depth } = REFRIGERATOR_PRESETS[style];
  const c = createCabinet("tall", id, width);
  return { ...c, width, height, depth, opening: "refrigerator", refrigeratorStyle: style,
    fitToCeiling: false, autoElevation: false, material: "matte", color: "#b9c0c0", handleStyle: "bar",
    position: { ...c.position, x: width / 2, z: depth / 2 } };
}
export function createHood(id: string, mount: HoodMount = "under-cabinet", width: CabinetWidth = 600): ModularCabinet {
  const c = createCabinet("wall", id, width);
  const depth = mount === "wall" ? 500 : c.depth;
  return { ...c, opening: "hood", hoodMount: mount, height: mount === "wall" ? 600 : c.height, depth,
    autoElevation: false, fitToCeiling: false,
    position: { ...c.position, y: 1450, z: depth / 2 } };
}
export function createModularKitchen(): ModularKitchen {
  const bases = [0, 1, 2, 3].map(i => {
    const cabinet = createCabinet("base", `base-${i + 1}`);
    return { ...cabinet, position: { ...cabinet.position, x: 500 + i * 600 } };
  });
  const wall = createCabinet("wall", "wall-1");
  wall.position.x = 500;
  return { version: 1, room: { width: 4000, depth: 3000, height: 2600 }, cabinets: [...bases, wall],
    wallClearance: 550, countertop: { thickness: 30, frontOverhang: 20, material: "wood" } };
}
export function roomWalls(room: KitchenRoom): KitchenWall[] {
  return [
    { id: "back", start: { x: 0, z: 0 }, end: { x: room.width, z: 0 }, inward: { x: 0, z: 1 } },
    { id: "right", start: { x: room.width, z: 0 }, end: { x: room.width, z: room.depth }, inward: { x: -1, z: 0 } },
    { id: "front", start: { x: room.width, z: room.depth }, end: { x: 0, z: room.depth }, inward: { x: 0, z: -1 } },
    { id: "left", start: { x: 0, z: room.depth }, end: { x: 0, z: 0 }, inward: { x: 1, z: 0 } },
  ];
}
export function validateCabinet(cabinet: ModularCabinet): string | null {
  if (cabinet.opening !== undefined && !["doors", "drawers", "open", "sink", "hob", "oven", "hood", "refrigerator"].includes(cabinet.opening)) return "Шүүгээний загвар буруу байна.";
  const spec = CABINET_DEFAULTS[cabinet.type];
  if (!spec) return "Шүүгээний төрөл буруу байна.";
  const fridge = cabinet.opening === "refrigerator", directHood = cabinet.opening === "hood" && cabinet.hoodMount === "wall";
  if (!Number.isInteger(cabinet.width) || (fridge ? cabinet.width < 450 || cabinet.width > 1200
    : !(cabinetWidths(cabinet.type) as readonly number[]).includes(cabinet.width) && !(cabinet.corner === true && cabinet.type === "base" && cabinet.width === 1000))) return fridge ? "Хөргөгчийн өргөн 450–1200 мм байна." : "Доод шүүгээ 300–1000 мм, дээд болон өндөр шүүгээ 300–900 мм байна.";
  const heightRange = fridge ? REFRIGERATOR_LIMITS.height : directHood ? [200, 1200] : spec.heightRange;
  const depthRange = fridge ? REFRIGERATOR_LIMITS.depth : directHood ? [250, 600] : spec.depthRange;
  if (!Number.isInteger(cabinet.height) || cabinet.height < heightRange[0] || cabinet.height > heightRange[1]) return `Өндөр ${heightRange.join("–")} мм байна.`;
  if (!Number.isInteger(cabinet.depth) || cabinet.depth < depthRange[0] || cabinet.depth > depthRange[1]) return `Гүн ${depthRange.join("–")} мм байна.`;
  if (![1, 2].includes(cabinet.doorCount) || (!fridge && cabinet.width < 600 && cabinet.doorCount === 2)) return "Хос хаалганд 600 мм-ээс багагүй өргөн сонгоно уу.";
  if (cabinet.corner !== undefined && typeof cabinet.corner !== "boolean") return "Булангийн сонголт буруу байна.";
  if (cabinet.cornerSide !== undefined && !["left", "right"].includes(cabinet.cornerSide)) return "Булангийн чиглэл буруу байна.";
  if (cabinet.corner && (cabinet.type === "tall" || cabinet.width <= cabinet.depth || ![undefined, "doors", "open"].includes(cabinet.opening) || cabinet.drawerCount !== 0)) return "Булангийн шүүгээ гүнээсээ өргөн, шургуулга болон төхөөрөмжгүй доод эсвэл дээд шүүгээ байна.";
  if (cabinet.hoodMount !== undefined && (!['under-cabinet', 'wall'].includes(cabinet.hoodMount) || cabinet.opening !== 'hood')) return "Утаа сорогчийн байрлал буруу байна.";
  if (cabinet.refrigeratorStyle !== undefined && (!['top-bottom', 'side-by-side'].includes(cabinet.refrigeratorStyle) || !fridge)) return "Хөргөгчийн загвар буруу байна.";
  if (!Number.isInteger(cabinet.drawerCount) || cabinet.drawerCount < 0 || cabinet.drawerCount > 4 || (cabinet.type === "wall" && cabinet.drawerCount > 0)) return "Шургуулга 0–4; дээд шүүгээ шургуулгагүй байна.";
  if (cabinet.opening === "drawers" && (cabinet.type === "wall" || cabinet.drawerCount < 1)) return "Шургуулгатай доод/өндөр шүүгээнд 1–4 шургуулга байна.";
  if (["sink", "open"].includes(cabinet.opening ?? "") && cabinet.drawerCount !== 0) return "Угаалтууртай болон ил тавиурын хэсэг шургуулгагүй байна.";
  if (!Object.values(cabinet.position).every(Number.isFinite) || cabinet.position.y < 0) return "Байрлалын хэмжээ буруу байна.";
  if (cabinet.type !== "wall" && cabinet.position.y !== 0) return "Доод болон өндөр шүүгээ шалан дээр байрлана.";
  if (!/^#[0-9a-f]{6}$/i.test(cabinet.color) || !["matte", "wood", "gloss"].includes(cabinet.material) || !["bar", "knob", "push-open"].includes(cabinet.handleStyle)) return "Материалын утга буруу байна.";
  return applianceIssue(cabinet);
}
