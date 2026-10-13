"use client";

import { useMemo } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { preferredKitchenVariant, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import { KitchenCabinetGLB } from "./KitchenCabinetGLB";
import { KitchenExtraMesh } from "./KitchenExtraMesh";

/** The editor, exported kitchen and room planner share the same published GLBs. */
export function KitchenAssemblyMesh({ kitchen, centered = false, open = false, selectedId, variantModels }: {
  kitchen: ModularKitchen;
  centered?: boolean;
  open?: boolean;
  selectedId?: string | null;
  variantModels?: Record<string, KitchenCatalogVariant>;
  /** Kept for existing callers; authored GLB materials define cabinet appearance. */
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
}) {
  const { moduleCatalog } = useKitchenCatalog(!variantModels);
  const models = useMemo(() => variantModels ?? Object.fromEntries(
    moduleCatalog.flatMap((module) => module.variants.map((variant) => [variant.furnitureModelId, variant])),
  ), [variantModels, moduleCatalog]);
  const bounds = kitchenEnvelope(kitchen);
  return <group position={centered ? [-bounds.centerX / 1000, 0, -bounds.centerZ / 1000] : [0, 0, 0]}>
    {kitchen.cabinets.map((cabinet) => <group key={cabinet.id} name={`Cabinet-${cabinet.id}`}
      position={[cabinet.position.x / 1000, cabinet.position.y / 1000, cabinet.position.z / 1000]}
      rotation={[0, cabinet.position.rotation, 0]}>
      <KitchenCabinetGLB cabinet={cabinet} selected={selectedId === cabinet.id}
        variant={cabinet.variantId ? models[cabinet.variantId] : preferredKitchenVariant(moduleCatalog, cabinet)}
        open={Boolean(open && cabinet.id === selectedId)} />
    </group>)}
    {(kitchen.extras ?? []).map((extra) => <group key={extra.id} name={`Extra-${extra.id}`}
      position={[extra.position.x / 1000, 0, extra.position.z / 1000]}
      rotation={[0, extra.position.rotation, 0]}>
      <KitchenExtraMesh extra={extra} />
    </group>)}
  </group>;
}
