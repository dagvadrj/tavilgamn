"use client";
import { useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

const urls = ["walnut", "linen"].flatMap((s) =>
  ["color", "normal", "roughness"].map(
    (c) => `/interior/premium/${s}-${c}.webp`,
  ),
);
export function useHybridMaterials() {
  const source = useLoader(THREE.TextureLoader, urls);
  const gl = useThree((s) => s.gl);
  const maps = useMemo(
    () =>
      source.map((t, i) => {
        const map = t.clone();
        map.colorSpace =
          i % 3 === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.repeat.setScalar(i < 3 ? 1 : 5);
        map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        return map;
      }),
    [source, gl],
  );
  const materials = useMemo(() => {
    const wood = new THREE.MeshStandardMaterial({
      color: "#a28a6e",
      map: maps[0],
      normalMap: maps[1],
      roughnessMap: maps[2],
      roughness: 0.85,
    });
    const fabric = new THREE.MeshStandardMaterial({
      color: "#d4cbbb",
      map: maps[3],
      normalMap: maps[4],
      roughnessMap: maps[5],
      roughness: 0.96,
    });
    return {
      wood,
      fabric,
      concrete: wood,
      floor: wood,
      rug: fabric,
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
      woodMap: maps[0],
      woodNormal: maps[1],
      woodRoughness: maps[2],
      fabricMap: maps[3],
      linenNormal: maps[4],
      linenRoughness: maps[5],
    };
  }, [maps]);
  useEffect(
    () => () => {
      new Set(Object.values(materials)).forEach((v) => v.dispose());
    },
    [materials],
  );
  return materials;
}
