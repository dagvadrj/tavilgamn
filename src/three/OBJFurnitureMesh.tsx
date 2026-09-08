"use client";
import { useEffect, useState, useRef } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

THREE.Cache.enabled = true;

// Shared promise cache so concurrent mounts of the same model share one load
const pending = new Map<string, Promise<THREE.Group>>();

function loadGroup(
  modelId: string,
  basePath: string,
  objFile: string,
  mtlFile: string,
): Promise<THREE.Group> {
  if (pending.has(modelId)) return pending.get(modelId)!;
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const p = (async () => {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(base);
    const mats = await new Promise<ReturnType<MTLLoader["parse"]>>((res, rej) =>
      mtlLoader.load(mtlFile, res, undefined, rej),
    );
    mats.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(mats);
    objLoader.setPath(base);
    const group = await new Promise<THREE.Group>((res, rej) =>
      objLoader.load(objFile, res, undefined, rej),
    );
    group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return group;
  })();
  pending.set(modelId, p);
  return p;
}

export interface OBJFurnitureMeshProps {
  modelId: string;
  basePath: string;
  objFile: string;
  mtlFile: string;
  scale: number;
  w: number;
  d: number;
  h: number;
  selected?: boolean;
}

export function OBJFurnitureMesh({
  modelId,
  basePath,
  objFile,
  mtlFile,
  scale,
  w,
  d,
  h,
  selected,
}: OBJFurnitureMeshProps) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadGroup(modelId, basePath, objFile, mtlFile)
      .then((g) => { if (mounted.current) setGroup(g.clone(true)); })
      .catch((e) => console.error("[OBJFurnitureMesh]", e));
    return () => { mounted.current = false; };
  }, [modelId, basePath, objFile, mtlFile]);

  if (!group) return null;

  return (
    <group>
      <primitive object={group} scale={scale} />
      {selected && (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w + 0.08, h + 0.08, d + 0.08]} />
          <meshBasicMaterial color="#C4633A" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
