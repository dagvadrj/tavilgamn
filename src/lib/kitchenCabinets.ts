/** Modular kitchen v1. All dimensions/positions are millimetres; yaw is radians.
 * Position is the footprint centre and cabinet bottom. Local +Z is the front.
 * The old run-based Kitchen type remains supported by the existing configurator.
 */
import { applianceIssue } from "./plitka";
import { roomOutline, wallSamples, type RoomOutlinePoint } from "./kitchenRoomOutline";
import type { KitchenExtra } from "./kitchenExtras";
import type { CabinetComponent } from "./kitchenComponents";
import type { Finish, FrontStyle } from "./kitchen";
import { pcmallAppliance } from "./pcmallAppliances";
export const CABINET_WIDTHS = [300, 400, 450, 500, 600, 700, 800, 900] as const;
export const BASE_CABINET_WIDTHS = [150, 200, ...CABINET_WIDTHS, 1000] as const;
export const cabinetWidths = (type: CabinetType) => type === "base" ? BASE_CABINET_WIDTHS : CABINET_WIDTHS;
/** Cabinet presets stay discrete; appliances retain their measured integer footprint. */
export type CabinetWidth = number;
export type CabinetType = "base" | "wall" | "tall";
export type KitchenLayout = "straight" | "l-right" | "l-left" | "u" | "double-side";
export type HoodMount = "under-cabinet" | "wall";
export type RefrigeratorStyle = "top-bottom" | "side-by-side";
export type CabinetHandle = "bar" | "knob" | "push-open";
export type CabinetMaterial = "matte" | "wood" | "gloss";
export type Point2 = { x: number; z: number };
export type CabinetPose = Point2 & { y: number; rotation: number };
export interface ModularCabinet {
  id: string;
  /** Optional kitchen_models-backed kitchen variant; dimensions remain authored here in mm. */
  variantId?: string;
  /** Adapt an actual catalog carcass for a countertop fixture or built-in oven. */
  catalogAdaptation?: "sink" | "hob" | "oven" | "hood";
  catalogHousing?: "oven-tower" | "fridge-integrated" | "wall-hood";
  refrigeratorInstallation?: "integrated" | "freestanding";
  applianceProductId?: string;
  /** Chosen GLB option IDs, keyed by the catalog assembly slot ID. Empty means removed. */
  partSelections?: Record<string, string>;
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
  /** Catalog material ids. Legacy finish remains the fallback for older saved designs. */
  frontMaterialId?: string;
  carcassMaterialId?: string;
  frontStyle?: FrontStyle;
  opening?: "doors" | "drawers" | "open" | "sink" | "hob" | "oven" | "hood" | "refrigerator";
  hoodMount?: HoodMount;
  refrigeratorStyle?: RefrigeratorStyle;
  corner?: boolean;
  cornerSide?: "left" | "right";
  components?: CabinetComponent[];
}
export interface KitchenSpaceItem { id: string; kind: "door" | "window" | "column" | "water" | "power" | "vent"; x: number; z: number; width: number; depth: number; wall: "back" | "front" | "left" | "right";
  height?: number; sillHeight?: number; swing?: "inward" | "outward" }
export interface KitchenRoom { width: number; depth: number; height: number; outline?: RoomOutlinePoint[]; openFront?: boolean; items?: KitchenSpaceItem[]; wallColors?: Partial<Record<KitchenSpaceItem["wall"], string>> }
export interface KitchenWall { id: string; sourceWall?: KitchenSpaceItem["wall"]; start: Point2; end: Point2; inward: Point2 }
export interface CountertopSettings { thickness: number; frontOverhang: number; material: "laminate" | "granite" | "wood"; finish?: Finish; materialId?: string; color?: string }
export interface Countertop extends CountertopSettings {
  id: string; cabinetIds: string[]; width: number; depth: number; position: CabinetPose;
  cutoutAnchor?: CabinetPose;
}
export interface ModularKitchen {
  version: 1; room: KitchenRoom; cabinets: ModularCabinet[];
  extras?: KitchenExtra[];
  layout?: KitchenLayout;
  wallClearance: number; countertop: CountertopSettings;
  backsplash?: boolean;
  backsplashMaterialId?: string;
  countertopLayout?: { mode: "manual"; panels: Countertop[] };
  cornerPlan?: import("./kitchenCornerGeometry").KitchenCornerPlan;
  lineLighting?: import("./kitchenLighting").KitchenLineLighting;

  backsplashSettings?: { mode: "full-run" | "manual"; panels: { id: string; width: number; height: number; thickness: number; position: CabinetPose }[] };
}
export const CABINET_DEFAULTS = {
  // 740mm legless bodies are catalog assets, not 840mm cabinets to be stretched.
  base: { label: "Доод шүүгээ", height: 840, depth: 600, heightRange: [740, 900], depthRange: [550, 650] },
  wall: { label: "Дээд шүүгээ", height: 740, depth: 350, heightRange: [400, 1200], depthRange: [250, 450] },
  tall: { label: "Өндөр шүүгээ", height: 2600, depth: 600, heightRange: [1800, 3500], depthRange: [550, 650] },
} as const;
export const DEFAULT_WALL_CLEARANCE = 550;
export const DEFAULT_COUNTERTOP_THICKNESS = 30;
export const REFRIGERATOR_PRESETS = {
  "top-bottom": { label: "Дээр, доор хаалгатай", width: 600, height: 1850, depth: 650 },
  "side-by-side": { label: "Зэрэгцээ хоёр том хаалгатай", width: 900, height: 1800, depth: 700 },
} as const;
export const REFRIGERATOR_LIMITS = { width: [450, 1200], height: [1400, 2300], depth: [500, 900] } as const;
export const HOOD_MOUNTS = [
  { id: "under-cabinet", label: "Шүүгээний доор" }, { id: "wall", label: "Шууд хананд" },
] as const;
export function cabinetLabel(cabinet: ModularCabinet) {
  if (cabinet.catalogAdaptation === 'hood') return 'Шүүгээнд суурилуулсан сорогч';
  if (cabinet.catalogHousing === 'wall-hood') return 'Хананд ил сорогч';
  if (cabinet.applianceProductId && cabinet.opening !== 'oven') {
    const appliance = pcmallAppliance(cabinet.applianceProductId);
    if (appliance) return `${appliance.label} · ${appliance.model}`;
  }
  if (cabinet.catalogHousing === 'fridge-integrated') return 'Суурилуулдаг хөргөгчийн box';
  if (cabinet.catalogHousing === 'oven-tower') return 'Зуухны өндөр box';
  if (cabinet.catalogAdaptation) return ({ sink: 'Угаалтуурын box', hob: 'Плитканы box', oven: 'Зуухны box', hood: 'Шүүгээнд суурилуулсан сорогч' })[cabinet.catalogAdaptation];
  if (cabinet.opening === "refrigerator") return "Хөргөгч";
  if (cabinet.opening === "hood") return cabinet.hoodMount === "wall" ? "Утаа сорогч" : "Утаа сорогчтой дээд шүүгээ";
  if (cabinet.corner) return cabinet.type === "wall" ? "Дээд булангийн шүүгээ" : "Доод булангийн шүүгээ";
  return CABINET_DEFAULTS[cabinet.type].label;
}
export function createCabinet(type: CabinetType, id: string, width: CabinetWidth = 600, ceiling = 2600): ModularCabinet {
  return { id, type, width, height: type === "tall" ? ceiling : CABINET_DEFAULTS[type].height,
    depth: CABINET_DEFAULTS[type].depth, doorCount: width >= 600 ? 2 : 1, drawerCount: 0,
    handleStyle: "bar", color: type === "wall" ? "#ece8df" : "#b99165", material: type === "wall" ? "matte" : "wood",
    position: {
      x: width / 2,
      y:
        type === "wall"
          ? CABINET_DEFAULTS.base.height +
            DEFAULT_COUNTERTOP_THICKNESS +
            DEFAULT_WALL_CLEARANCE
          : 0,
      z: CABINET_DEFAULTS[type].depth / 2,
      rotation: 0,
    },
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
    wallClearance: DEFAULT_WALL_CLEARANCE, countertop: { thickness: DEFAULT_COUNTERTOP_THICKNESS, frontOverhang: 20, material: "wood" } };
}
export function roomWalls(room: KitchenRoom): KitchenWall[] {
  if (room.outline) {
    // Merge straight subdivisions so a cabinet/opening can span an inserted point.
    const points=roomOutline(room).map(p=>({...p}));
    for (let i=points.length-1;i>=0 && points.length>3;i--) {
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
      if(!a.curve && !b.curve && a.wall===b.wall && Math.abs((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x))<0.001) points.splice(i,1);
    }
    return points.flatMap((start,i)=>{
      if(room.openFront && start.wall==="front") return [];
      const samples=wallSamples(start,points[(i+1)%points.length]);
      return samples.slice(0,-1).flatMap((p,j)=>{
        const end=samples[j+1],dx=end.x-p.x,dz=end.z-p.z,length=Math.hypot(dx,dz);
        return length<0.001 ? [] : [{id:`${start.wall}-${i}-${j}`,sourceWall:start.wall,start:p,end,inward:{x:-dz/length,z:dx/length}}];
      });
    });
  }
  const walls: KitchenWall[] = [
    { id: "back", start: { x: 0, z: 0 }, end: { x: room.width, z: 0 }, inward: { x: 0, z: 1 } },
    { id: "right", start: { x: room.width, z: 0 }, end: { x: room.width, z: room.depth }, inward: { x: -1, z: 0 } },
    { id: "front", start: { x: room.width, z: room.depth }, end: { x: 0, z: room.depth }, inward: { x: 0, z: -1 } },
    { id: "left", start: { x: 0, z: room.depth }, end: { x: 0, z: 0 }, inward: { x: 1, z: 0 } },
  ];
  return room.openFront ? walls.filter(wall => wall.id !== "front") : walls;
}
export function validateCabinet(cabinet: ModularCabinet): string | null {
  if (cabinet.catalogAdaptation !== undefined && (!['sink', 'hob', 'oven', 'hood'].includes(cabinet.catalogAdaptation) || cabinet.catalogAdaptation !== cabinet.opening || cabinet.type !== (cabinet.catalogAdaptation === 'hood' ? 'wall' : 'base') || !cabinet.variantId))
    return "Төхөөрөмжийн box-ийн тохируулга буруу байна.";
  if (cabinet.catalogHousing !== undefined && !(
    cabinet.catalogHousing === 'oven-tower' && cabinet.type === 'tall' && cabinet.opening === 'oven' ||
    cabinet.catalogHousing === 'fridge-integrated' && cabinet.type === 'tall' && cabinet.opening === 'refrigerator' && cabinet.refrigeratorInstallation === 'integrated' ||
    cabinet.catalogHousing === 'wall-hood' && cabinet.type === 'wall' && cabinet.opening === 'hood' && cabinet.hoodMount === 'wall'))
    return 'Төхөөрөмжийн захиалгат box-ийн төрөл буруу байна.';
  if (cabinet.refrigeratorInstallation !== undefined && (!['integrated', 'freestanding'].includes(cabinet.refrigeratorInstallation) || cabinet.opening !== 'refrigerator'))
    return 'Хөргөгчийн суурилуулалтын төрөл буруу байна.';
  const appliance = cabinet.applianceProductId ? pcmallAppliance(cabinet.applianceProductId) : undefined;
  if (cabinet.applianceProductId && (!appliance || !({ oven: 'oven', hood: 'hood', refrigerator: 'fridge' } as Record<string, string>)[cabinet.opening ?? ''] || appliance.type !== ({ oven: 'oven', hood: 'hood', refrigerator: 'fridge' } as Record<string, string>)[cabinet.opening ?? '']))
    return "Сонгосон төхөөрөмж шүүгээний зориулалттай тохирохгүй байна.";
  if (appliance && cabinet.opening !== 'oven' && cabinet.catalogAdaptation !== 'hood' && cabinet.catalogHousing !== 'wall-hood' && (cabinet.width !== appliance.width || cabinet.height !== appliance.height || cabinet.depth !== appliance.depth))
    return "Сангийн төхөөрөмжийн бодит хэмжээг өөрчлөхгүй. Өөр төхөөрөмж сонгоно уу.";

  if (cabinet.opening !== undefined && !["doors", "drawers", "open", "sink", "hob", "oven", "hood", "refrigerator"].includes(cabinet.opening)) 
    return "Шүүгээний загвар буруу байна.";
  const spec = CABINET_DEFAULTS[cabinet.type];
  if (!spec) return "Шүүгээний төрөл буруу байна.";
  const fridge = cabinet.opening === "refrigerator", directHood = cabinet.opening === "hood" && cabinet.hoodMount === "wall";
  const catalogSize=typeof cabinet.variantId==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cabinet.variantId);
  const measuredHood = directHood && appliance?.type === 'hood' && cabinet.width === appliance.width && (cabinet.height === appliance.height || cabinet.catalogHousing === 'wall-hood' && cabinet.height >= appliance.height && cabinet.height <= 1200) && cabinet.depth === appliance.depth;
  if (!Number.isInteger(cabinet.width) || (fridge ? cabinet.width < 450 || cabinet.width > 1200
    : measuredHood ? false
    : catalogSize ? cabinet.width<150 || cabinet.width>2400 : !(cabinetWidths(cabinet.type) as readonly number[]).includes(cabinet.width) && !(cabinet.corner === true && cabinet.type === "base" && cabinet.width === 1000))) return fridge ? "Хөргөгчийн өргөн 450–1200 мм байна." : "Шүүгээний өргөн стандарт хэмжээтэй байна.";
  const heightRange = fridge ? REFRIGERATOR_LIMITS.height : measuredHood ? [appliance.height, cabinet.catalogHousing === 'wall-hood' ? 1200 : appliance.height] : directHood ? [200, 1200] : spec.heightRange;
  const depthRange = fridge ? REFRIGERATOR_LIMITS.depth : directHood ? [250, 600] : catalogSize ? [250,1200] : spec.depthRange;
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
