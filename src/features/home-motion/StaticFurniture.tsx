"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Merge the fixed parts of one furniture item once, before a room transition.
 * Keep the authored React subtree for color updates; it never renders. */
export function StaticFurniture({ children }: { children: ReactNode }) {
  const source = useRef<THREE.Group>(null),
    result = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    if (!source.current || !result.current) return;
    const output = result.current;
    source.current.updateWorldMatrix(true, true);
    const inverse = source.current.matrixWorld.clone().invert();
    const buckets = new Map<
      string,
      { material: THREE.MeshStandardMaterial; geometry: THREE.BufferGeometry[] }
    >();
    const owned: THREE.BufferGeometry[] = [];
    const instances: THREE.InstancedMesh[] = [];
    source.current.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
        return;
      const transform = inverse.clone().multiply(object.matrixWorld);
      if (object instanceof THREE.InstancedMesh) {
        const clone = object.clone();
        clone.matrixAutoUpdate = false;
        clone.matrix.copy(transform);
        output.add(clone);
        instances.push(clone);
        return;
      }
      const m = object.material;
      if (!(m instanceof THREE.MeshStandardMaterial)) return;
      const key = JSON.stringify([
        m.color.getHex(),
        m.emissive.getHex(),
        m.emissiveIntensity,
        m.roughness,
        m.metalness,
        m.map?.uuid,
        m.normalMap?.uuid,
        m.roughnessMap?.uuid,
        m.normalScale.toArray(),
        m.side,
      ]);
      let geometry = object.geometry.clone().applyMatrix4(transform);
      if (geometry.index) {
        const indexed = geometry;
        geometry = indexed.toNonIndexed();
        indexed.dispose();
      }
      // The primitives use position/normal/uv only. Normalize optional attributes.
      for (const name of Object.keys(geometry.attributes))
        if (!["position", "normal", "uv"].includes(name))
          geometry.deleteAttribute(name);
      if (!buckets.has(key)) buckets.set(key, { material: m, geometry: [] });
      buckets.get(key)!.geometry.push(geometry);
    });
    for (const { material, geometry } of buckets.values()) {
      const merged = mergeGeometries(geometry, false);
      if (merged) {
        output.add(new THREE.Mesh(merged, material));
        owned.push(merged);
      }
      geometry.forEach((g) => g.dispose());
    }
    invalidate();
    return () => {
      output.clear();
      owned.forEach((g) => g.dispose());
      instances.forEach((m) => m.dispose());
    };
  }, [children, invalidate]);
  return (
    <>
      <group ref={source} visible={false}>
        {children}
      </group>
      <group ref={result} dispose={null} />
    </>
  );
}
