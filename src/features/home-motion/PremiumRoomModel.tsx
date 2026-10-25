"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "@/three/modelLoader";

export function PremiumRoomModel({
  url,
  size,
  color,
  onStatus,
  children,
}: {
  url?: string;
  size: readonly [number, number, number];
  color?: string;
  onStatus?: (status: string) => void;
  children?: ReactNode;
}) {
  const { gl, invalidate } = useThree();
  const [asset, setAsset] = useState<{
    model: LoadedModel;
    release: () => void;
  } | null>(null);
  useEffect(() => {
    if (!url) {
      setAsset(null);
      onStatus?.("preview");
      return;
    }
    let cancelled = false,
      transferred = false;
    const lease = acquireModel(gl, url);
    onStatus?.("loading");
    void lease.promise
      .then((model) => {
        if (cancelled) return;
        const owned = cloneModel(model);
        // The loader shares cached geometry/textures. Own only the materials we tint.
        const materials = new Map<THREE.Material, THREE.Material>();
        const copy = (m: THREE.Material) => {
          if (!materials.has(m)) materials.set(m, m.clone());
          return materials.get(m)!;
        };
        owned.scene.traverse((object) => {
          if (object instanceof THREE.Mesh)
            object.material = Array.isArray(object.material)
              ? object.material.map(copy)
              : copy(object.material);
        });
        transferred = true;
        setAsset({ model: owned, release: lease.release });
        onStatus?.("ready");
        gl.shadowMap.needsUpdate = true;
        invalidate();
      })
      .catch(() => {
        if (!cancelled) onStatus?.("error");
      });
    return () => {
      cancelled = true;
      if (!transferred) lease.release();
    };
  }, [url, gl, invalidate, onStatus]);
  useEffect(
    () => () => {
      if (asset) {
        const materials = new Set<THREE.Material>();
        asset.model.scene.traverse((object) => {
          if (object instanceof THREE.Mesh)
            (Array.isArray(object.material)
              ? object.material
              : [object.material]
            ).forEach((m) => materials.add(m));
        });
        materials.forEach((m) => m.dispose());
        disposeModelClone(asset.model);
        asset.release();
      }
    },
    [asset],
  );
  useEffect(() => {
    if (!asset) return;
    asset.model.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (!m.userData.roomOriginal) m.userData.roomOriginal = m.color.clone();
        m.color.copy(m.userData.roomOriginal);
        // Keep photographic base-color, normal and roughness maps intact.
        if (
          color &&
          m.metalness < 0.5 &&
          !/metal|chrome|leg|frame|wood|handle/i.test(m.name)
        )
          m.color.multiply(new THREE.Color(color));
      }
    });
    invalidate();
  }, [asset, color, invalidate]);
  const fit = useMemo(() => {
    if (!asset) return null;
    const b = asset.model.bounds,
      d = b.getSize(new THREE.Vector3()),
      c = b.getCenter(new THREE.Vector3());
    const scale = Math.min(size[0] / d.x, size[1] / d.y, size[2] / d.z);
    return {
      scale,
      position: [-c.x * scale, -b.min.y * scale, -c.z * scale] as [
        number,
        number,
        number,
      ],
    };
  }, [asset, size]);
  return asset && fit ? (
    <group dispose={null}>
      <primitive object={asset.model.scene} {...fit} />
    </group>
  ) : (
    <>{children}</>
  );
}
