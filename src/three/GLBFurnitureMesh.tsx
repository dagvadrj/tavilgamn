"use client";
import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import { isKitchenMaterialTarget } from "@/lib/kitchenMaterials";

import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "./modelLoader";

export interface GLBFurnitureMeshProps {
  modelId: string;
  basePath: string;
  glbFile: string;
  w: number;
  d: number;
  h: number;
  selected?: boolean;
  materialOverride?: { color: string; roughness: number; metalness: number };
  onReady?: () => void;
}
type Display = {
  key: string;
  asset: LoadedModel;
  release: () => void;
};
export function GLBFurnitureMesh({
  modelId,
  basePath,
  glbFile,
  w,
  d,
  h,
  materialOverride,
  onReady,
}: GLBFurnitureMeshProps) {
  const { gl } = useThree();
  const callbacks = useRef({ onReady });
  callbacks.current = { onReady };
  const [display, setDisplay] = useState<Display | null>(null);
  const owned = useRef(new Set<Display>());

  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const key = `${modelId}:${base}${glbFile}`;
  const overrideColor = materialOverride?.color;
  const overrideRoughness = materialOverride?.roughness;
  const overrideMetalness = materialOverride?.metalness;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDisplay(null);

    const lease = acquireModel(gl, base + glbFile);
    let transferred = false;

    const load = async () => {
      try {
        const asset = await lease.promise;
        if (cancelled) return;
        const cloned = cloneModel(asset);

        cloned.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          const clonedMaterials = materials.map((material) => {
            const clonedMaterial = material.clone();
            if (clonedMaterial instanceof THREE.MeshStandardMaterial) {
              clonedMaterial.normalMap = null;
              clonedMaterial.aoMap = null;
              clonedMaterial.side = THREE.DoubleSide;
              if (
                overrideColor !== undefined &&
                overrideRoughness !== undefined &&
                overrideMetalness !== undefined &&
                isKitchenMaterialTarget(object.name, clonedMaterial.name)
              ) {
                clonedMaterial.color.set(overrideColor);
                clonedMaterial.roughness = overrideRoughness;
                clonedMaterial.metalness = overrideMetalness;
              }
              clonedMaterial.needsUpdate = true;
            }
            return clonedMaterial;
          });
          object.material = Array.isArray(object.material)
            ? clonedMaterials
            : clonedMaterials[0];
        });
        const next: Display = {
          key,
          asset: cloned,
          release: lease.release,
        };
        transferred = true;
        owned.current.add(next);
        setDisplay(next);
        callbacks.current.onReady?.();
      } catch (error) {
        console.error("[GlbFurnitureMesh]", error);
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!transferred) lease.release();
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    gl,
    base,
    glbFile,
    key,
    retry,
    overrideColor,
    overrideRoughness,
    overrideMetalness,
  ]);

  useEffect(() => {
    // Cached low/high promises may settle in the same React batch. Release even
    // clones whose intermediate state never reached a commit.
    for (const item of owned.current)
      if (item !== display) {
        disposeModelClone(item.asset);
        item.release();
        owned.current.delete(item);
      }
  }, [display]);
  useEffect(() => {
    const items = owned.current;
    return () => {
      for (const item of items) {
        disposeModelClone(item.asset);
        item.release();
      }
      items.clear();
    };
  }, []);

  const ready = display?.key === key ? display : null;
  const size = ready?.asset.bounds.getSize(new THREE.Vector3());
  const origin = ready?.asset.bounds.getCenter(new THREE.Vector3());
  const valid = size && origin && Math.min(size.x, size.y, size.z) > 1e-9;
  return (
    <group>
      {ready && valid ? (
        <group scale={[w / size.x, h / size.y, d / size.z]} dispose={null}>
          <primitive
            object={ready.asset.scene}
            position={[-origin.x, -ready.asset.bounds.min.y, -origin.z]}
            dispose={null}
          />
        </group>
      ) : (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={error ? "#d5a995" : "#d4dcd0"}
            transparent
            opacity={0.45}
          />
          <Edges color="#6b7e68" />
        </mesh>
      )}
      {(!ready || error) && (
        <Html position={[0, h + 0.1, 0]} center zIndexRange={[8, 0]}>
          {error ? (
            <button
              type="button"
              className="rounded bg-white px-2 py-1 text-xs whitespace-nowrap"
              onClick={(event) => {
                event.stopPropagation();
                setRetry((value) => value + 1);
              }}
            >
              3D дахин ачаалах
            </button>
          ) : (
            <span
              role="status"
              className="pointer-events-none whitespace-nowrap rounded bg-white/90 px-2 py-1 text-xs"
            >
              3D ачаалж байна…
            </span>
          )}
        </Html>
      )}
    </group>
  );
}
