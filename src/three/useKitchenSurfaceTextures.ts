"use client";

import { useEffect, useMemo, useState } from "react";
import type { Finish } from "@/lib/kitchen";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { acquireKitchenMaterialTextures, type KitchenMaterialTextureSet } from "./kitchenMaterialTextures";
import { createKitchenTexture } from "./kitchenTextures";

/** Generated boards use the same catalog texture pool as uploaded cabinet parts. */
export function useKitchenSurfaceTextures(definition: KitchenMaterialDefinition | undefined, finish: Finish) {
  const pathsKey = JSON.stringify(definition?.texturePaths ?? {});
  const [loaded, setLoaded] = useState<{ key: string; textures: KitchenMaterialTextureSet }>();
  const procedural = !definition || ["oak", "walnut", "marble", "concrete"].includes(definition.id);
  const fallback = useMemo(() => procedural ? createKitchenTexture(finish) : null, [procedural, finish]);
  useEffect(() => () => fallback?.dispose(), [fallback]);
  useEffect(() => {
    let cancelled = false;
    const lease = acquireKitchenMaterialTextures(JSON.parse(pathsKey));
    void lease.promise.then(textures => { if (!cancelled) setLoaded({ key: pathsKey, textures }); });
    return () => { cancelled = true; lease.release(); };
  }, [pathsKey]);
  const textures = loaded?.key === pathsKey ? loaded.textures : {};
  return {
    map: textures.baseColor ?? fallback,
    normalMap: textures.normal ?? null,
    roughnessMap: textures.roughness ?? null,
    metalnessMap: textures.metalness ?? null,
  };
}
