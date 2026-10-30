"use client";
import { PCMALL_APPLIANCES, PCMALL_MODEL_BASE_PATH, pcmallAppliance } from "@/lib/pcmallAppliances";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import { ovenSlot } from "@/lib/plitka";
import { hoodMountPosition } from "@/lib/kitchenHoodMounting";

export function KitchenCatalogAppliance({ cabinet, cooktop = false }: { cabinet: ModularCabinet; cooktop?: boolean }) {
  const type = cooktop ? "cooktop" : cabinet.opening === "refrigerator" ? "fridge" : cabinet.opening;
  const appliance = !cooktop && cabinet.applianceProductId ? pcmallAppliance(cabinet.applianceProductId) : PCMALL_APPLIANCES.find(a => a.type === type);
  if (!appliance) return null;
  const oven = type === "oven";
  // Local origin is the cabinet floor; a cooktop caller supplies the worktop surface.
  const underCabinet = type === 'hood' && cabinet.hoodMount === 'under-cabinet';
  const hoodPose = hoodMountPosition({ depth: cabinet.depth, position: { x: 0, y: 0, z: 0, rotation: 0 } }, appliance);
  const y = cooktop ? -(appliance.height - 3) / 1000 : oven ? (cabinet.type === 'tall' ? (ovenSlot(cabinet)?.bottom ?? 900) + 5 : cabinet.height - appliance.height) / 1000 : underCabinet ? -appliance.height / 1000 : 0;
  const z = oven ? (cabinet.depth - appliance.depth + 24) / 2000 : underCabinet ? hoodPose.z / 1000 : 0;
  return <group name={`Catalog-appliance-${appliance.type}-${cabinet.id}`}>
    {cabinet.catalogHousing === 'wall-hood' && <mesh castShadow receiveShadow position={[0, (appliance.height + cabinet.height) / 2000, -cabinet.depth / 2000 + .1]}>
      <boxGeometry args={[.18, (cabinet.height - appliance.height) / 1000, .18]} />
      <meshStandardMaterial color="#aeb3b9" roughness={.32} metalness={.82} />
    </mesh>}
    <group position={[0, y, z]}>
    <GLBFurnitureMesh modelId={appliance.id} basePath={PCMALL_MODEL_BASE_PATH} glbFile={`${appliance.type}.glb`}
      w={appliance.width / 1000} h={appliance.height / 1000} d={appliance.depth / 1000}
      preservePhysicalSize strictDimensions showLoadStatus={false} />
    </group>
  </group>;
}
