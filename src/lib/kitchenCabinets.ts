/** Modular kitchen v1. All dimensions/positions are millimetres; yaw is radians.
 * Position is the footprint centre and cabinet bottom. Local +Z is the front.
 * The old run-based Kitchen type remains supported by the existing configurator.
 */
export const CABINET_WIDTHS = [300, 400, 600, 800] as const;
export type CabinetWidth = (typeof CABINET_WIDTHS)[number];
export type CabinetType = "base" | "wall" | "tall";
export type CabinetHandle = "bar" | "knob" | "push-open";
export type CabinetMaterial = "matte" | "wood" | "gloss";
export type Point2 = { x: number; z: number };
export type CabinetPose = Point2 & { y: number; rotation: number };
export interface ModularCabinet {
  id: string;
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
}
export interface KitchenRoom { width: number; depth: number; height: number }
export interface KitchenWall { id: string; start: Point2; end: Point2; inward: Point2 }
export interface CountertopSettings { thickness: number; frontOverhang: number; material: "laminate" | "granite" | "wood" }
export interface Countertop extends CountertopSettings {
  id: string; cabinetIds: string[]; width: number; depth: number; position: CabinetPose;
}
export interface ModularKitchen {
  version: 1; room: KitchenRoom; cabinets: ModularCabinet[];
  wallClearance: number; countertop: CountertopSettings;
}
export const CABINET_DEFAULTS = {
  base: { label: "Доод шүүгээ", height: 820, depth: 600, heightRange: [800, 900], depthRange: [550, 650] },
  wall: { label: "Дээд шүүгээ", height: 720, depth: 350, heightRange: [400, 1200], depthRange: [250, 450] },
  tall: { label: "Өндөр шүүгээ", height: 2600, depth: 600, heightRange: [1800, 3500], depthRange: [550, 650] },
} as const;
export function createCabinet(type: CabinetType, id: string, width: CabinetWidth = 600, ceiling = 2600): ModularCabinet {
  return { id, type, width, height: type === "tall" ? ceiling : CABINET_DEFAULTS[type].height,
    depth: CABINET_DEFAULTS[type].depth, doorCount: width >= 600 ? 2 : 1, drawerCount: 0,
    handleStyle: "bar", color: type === "wall" ? "#ece8df" : "#b99165", material: type === "wall" ? "matte" : "wood",
    position: { x: width / 2, y: type === "wall" ? 1400 : 0, z: CABINET_DEFAULTS[type].depth / 2, rotation: 0 },
    autoElevation: type === "wall", fitToCeiling: type === "tall" };
}
export function createModularKitchen(): ModularKitchen {
  const bases = [0, 1, 2, 3].map(i => {
    const cabinet = createCabinet("base", `base-${i + 1}`);
    return { ...cabinet, position: { ...cabinet.position, x: 500 + i * 600 } };
  });
  const wall = createCabinet("wall", "wall-1");
  wall.position.x = 500;
  return { version: 1, room: { width: 4000, depth: 3000, height: 2600 }, cabinets: [...bases, wall],
    wallClearance: 550, countertop: { thickness: 30, frontOverhang: 20, material: "laminate" } };
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
  const spec = CABINET_DEFAULTS[cabinet.type];
  if (!spec || !CABINET_WIDTHS.includes(cabinet.width)) return "Өргөн 300, 400, 600 эсвэл 800 мм байна.";
  if (!Number.isInteger(cabinet.height) || cabinet.height < spec.heightRange[0] || cabinet.height > spec.heightRange[1]) return `Өндөр ${spec.heightRange.join("–")} мм байна.`;
  if (!Number.isInteger(cabinet.depth) || cabinet.depth < spec.depthRange[0] || cabinet.depth > spec.depthRange[1]) return `Гүн ${spec.depthRange.join("–")} мм байна.`;
  if (![1, 2].includes(cabinet.doorCount) || (cabinet.width < 600 && cabinet.doorCount === 2)) return "Хос хаалганд 600 эсвэл 800 мм өргөн сонгоно уу.";
  if (!Number.isInteger(cabinet.drawerCount) || cabinet.drawerCount < 0 || cabinet.drawerCount > 4 || (cabinet.type === "wall" && cabinet.drawerCount > 0)) return "Шургуулга 0–4; дээд шүүгээ шургуулгагүй байна.";
  if (!Object.values(cabinet.position).every(Number.isFinite) || cabinet.position.y < 0) return "Байрлалын хэмжээ буруу байна.";
  if (cabinet.type !== "wall" && cabinet.position.y !== 0) return "Доод болон өндөр шүүгээ шалан дээр байрлана.";
  if (!/^#[0-9a-f]{6}$/i.test(cabinet.color) || !["matte", "wood", "gloss"].includes(cabinet.material) || !["bar", "knob", "push-open"].includes(cabinet.handleStyle)) return "Материалын утга буруу байна.";
  return null;
}
