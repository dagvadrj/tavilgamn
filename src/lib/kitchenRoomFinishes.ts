import { FLOOR_MATERIALS } from "./roomMaterials";

/** Kitchen floors: hard surfaces only, carpet does not belong by a sink. */
export const KITCHEN_FLOOR_MATERIALS = FLOOR_MATERIALS.filter((material) => material.category !== "Хивс");

/** Quiet wall paints that sit behind any cabinet finish; the first is the planner default. */
export const KITCHEN_WALL_PAINTS = [
  { color: "#d9d8d3", label: "Саарал цагаан" },
  { color: "#f2efe8", label: "Дулаан цагаан" },
  { color: "#e4dccd", label: "Цайвар шаргал" },
  { color: "#c8cfc3", label: "Зөөлөн ногоон" },
  { color: "#b8c2cb", label: "Хөх саарал" },
  { color: "#8f969c", label: "Чулуун саарал" },
] as const;
