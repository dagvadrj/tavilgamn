import type { MeshStandardMaterialParameters } from "three";

/** Satin wood reflects broad lights without becoming a furniture mirror. */
export function roomFloorFinish(materialId: string | undefined, surface: MeshStandardMaterialParameters) {
  const wood = materialId?.startsWith("parquet-") || materialId?.startsWith("laminate-");
  return {
    roughness: Math.max(0.12, Math.min(1, (surface.roughness ?? 0.86) * (wood ? 0.74 : 1))),
    clearcoat: wood ? 0.28 : 0,
    clearcoatRoughness: 0.34,
    clearcoatNormalMap: wood ? surface.normalMap : null,
    clearcoatNormalScale: surface.normalScale,
    envMapIntensity: wood ? 1.05 : 0.65,
    metalness: 0,
  };
}
