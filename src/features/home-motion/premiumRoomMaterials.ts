"use client";
import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

const surfaces = ["concrete", "parquet", "walnut", "linen"] as const;
const slots = ["color", "normal", "roughness"] as const;
const urls = surfaces.flatMap((surface) =>
  slots.map((slot) => `/interior/premium/${surface}-${slot}.webp`),
);
export function usePremiumRoomMaterials() {
  // Load CPU images first: useTexture would also upload unused source textures,
  // then upload our repeat/color-space variants a second time.
  const source = useLoader(THREE.TextureLoader, urls);
  const { gl } = useThree();
  const maps = useMemo(
    () =>
      source.map((texture, i) => {
        const clone = texture.clone();
        clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
        clone.colorSpace =
          i % 3 === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        clone.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        const repeat = [
          [3.5, 1.4],
          [3.2, 3.2],
          [1, 1],
          [5, 5],
        ][Math.floor(i / 3)];
        clone.repeat.set(repeat[0], repeat[1]);
        clone.needsUpdate = true;
        return clone;
      }),
    [source, gl],
  );
  const materials = useMemo(() => {
    const pbr = (i: number, color: string, roughness: number, scale: number) =>
      new THREE.MeshStandardMaterial({
        color,
        map: maps[i],
        normalMap: maps[i + 1],
        roughnessMap: maps[i + 2],
        roughness,
        normalScale: new THREE.Vector2(scale, scale),
      });
    return {
      concrete: pbr(0, "#89877e", 0.95, 0.22),
      floor: pbr(3, "#665344", 0.68, 0.35),
      wood: pbr(6, "#68513d", 0.65, 0.25),
      fabric: pbr(9, "#d4cbbb", 0.96, 0.25),
      rug: pbr(9, "#716758", 1, 0.65),
      metal: new THREE.MeshStandardMaterial({
        color: "#25231e",
        roughness: 0.35,
        metalness: 0.78,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: "#ac8550",
        roughness: 0.3,
        metalness: 0.82,
      }),
      linenNormal: maps[10],
      linenRoughness: maps[11],
      woodMap: maps[6],
      woodNormal: maps[7],
      woodRoughness: maps[8],
      fabricMap: maps[9],
    };
  }, [maps]);
  useEffect(
    () => () => {
      Object.values(materials).forEach((v) => {
        if (v instanceof THREE.Material) v.dispose();
      });
      maps.forEach((t) => t.dispose());
    },
    [materials, maps],
  );
  return materials;
}
export type PremiumMaterials = ReturnType<typeof usePremiumRoomMaterials>;
