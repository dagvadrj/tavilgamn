"use client";

import { useMemo } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { kitchenVariantFits, kitchenVariantFromModule, preferredKitchenVariant, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import { KitchenCabinetGLB } from "./KitchenCabinetGLB";
import { KitchenTops } from "./KitchenTops";
import { KitchenExtraMesh } from "./KitchenExtraMesh";

/** Editor and room preview share compatible assets, authored cabinets and fitted surfaces. */
export function KitchenAssemblyMesh({ kitchen, centered = false, open = false, selectedId, variantModels, materialDefinitions }: {
  kitchen: ModularKitchen;
  centered?: boolean;
  open?: boolean;
  selectedId?: string | null;
  variantModels?: Record<string, KitchenCatalogVariant>;
  /** Materials for parametric cabinets; uploaded GLBs retain their authored materials. */
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
}) {
  const { moduleCatalog } = useKitchenCatalog(!variantModels);
  const models = useMemo(() => variantModels ?? Object.fromEntries(
    moduleCatalog.filter(module => module.active).flatMap((module) => module.variants.filter(variant => variant.active).map((variant) => [variant.furnitureModelId, kitchenVariantFromModule(module, variant)])),
  ), [variantModels, moduleCatalog]);
  const bounds = kitchenEnvelope(kitchen);
  return <group position={centered ? [-bounds.centerX / 1000, 0, -bounds.centerZ / 1000] : [0, 0, 0]}>
    {kitchen.cabinets.map((cabinet) => <group key={cabinet.id} name={`Cabinet-${cabinet.id}`}
      position={[cabinet.position.x / 1000, cabinet.position.y / 1000, cabinet.position.z / 1000]}
      rotation={[0, cabinet.position.rotation, 0]}>
      <KitchenCabinetGLB cabinet={cabinet} selected={selectedId === cabinet.id}
        materialDefinitions={materialDefinitions}
        variant={cabinet.variantId ? models[cabinet.variantId] : preferredKitchenVariant(moduleCatalog, cabinet)}
        open={Boolean(open && cabinet.id === selectedId)} />
    </group>)}
    <KitchenTops kitchen={kitchen} materialDefinitions={materialDefinitions}
      catalogApplianceIds={kitchen.cabinets.filter(c => { const v = c.variantId ? models[c.variantId] : preferredKitchenVariant(moduleCatalog, c); return kitchenVariantFits(v, c); }).map(c => c.id)} />
    {(kitchen.extras ?? []).map((extra) => <group key={extra.id} name={`Extra-${extra.id}`}
      position={[extra.position.x / 1000, 0, extra.position.z / 1000]}
      rotation={[0, extra.position.rotation, 0]}>
      <KitchenExtraMesh extra={extra} />
    </group>)}
  </group>;
}
