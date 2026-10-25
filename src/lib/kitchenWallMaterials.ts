import type { KitchenMaterialDefinition } from "./kitchenMaterials";

export const KITCHEN_WALL_MATERIALS: KitchenMaterialDefinition[] = [
  { id: "wall-tiles-white", name: "Цагаан плитка", surfaceKind: "general", baseColor: "#FFFFFF", roughness: 0.35, metalness: 0,
    texturePaths: { baseColor: "/materials/wall-tiles-white.svg" } },
  { id: "wall-tiles-grey", name: "Саарал плитка", surfaceKind: "general", baseColor: "#FFFFFF", roughness: 0.55, metalness: 0,
    texturePaths: { baseColor: "/materials/wall-tiles-grey.svg" } },
];
