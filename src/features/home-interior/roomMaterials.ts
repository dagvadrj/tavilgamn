"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type RoomMaterials = {
  wood?: THREE.Texture;
  woodNormal?: THREE.Texture;
  woodRoughness?: THREE.Texture;
  plaster?: THREE.DataTexture;
  linen?: THREE.DataTexture;
};

function surfaceTexture(woven: boolean) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 3187;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296 - 0.5) * (woven ? 18 : 28);
      const weave = woven
        ? Math.sin((x * Math.PI) / 2) * 24 + Math.sin((y * Math.PI) / 2) * 24
        : 0;
      const offset = (y * size + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 175 + noise + weave;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(woven ? 12 : 4, woven ? 12 : 4);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Local assets only; texture failures leave a usable untextured room. */
export function useRoomMaterials(): RoomMaterials {
  const { gl, scene, invalidate } = useThree();
  const [materials, setMaterials] = useState<RoomMaterials>({});
  useEffect(() => {
    let active = true;
    const owned: THREE.Texture[] = [];
    const plaster = surfaceTexture(false);
    const linen = surfaceTexture(true);
    owned.push(plaster, linen);
    setMaterials({ plaster, linen });
    const loader = new THREE.TextureLoader();
    const files = [
      ["wood", "color.webp"],
      ["woodNormal", "normal.png"],
      ["woodRoughness", "roughness.png"],
    ] as const;
    for (const [key, suffix] of files) {
      const texture = loader.load(
        `/textures/room/oak-natural-v1-${suffix}`,
        (loaded) => {
          if (!active) return;
          setMaterials((previous) => ({ ...previous, [key]: loaded }));
          invalidate();
        },
        undefined,
        () => {},
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 2);
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      texture.colorSpace =
        key === "wood" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      owned.push(texture);
    }
    const environment = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const target = generator.fromScene(environment, 0.04, 0.1, 100);
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = 0.45;
    environment.dispose();
    generator.dispose();
    invalidate();
    return () => {
      active = false;
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      target.dispose();
      owned.forEach((texture) => texture.dispose());
    };
  }, [gl, scene, invalidate]);
  return materials;
}
