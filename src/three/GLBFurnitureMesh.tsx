"use client";
import { useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

THREE.Cache.enabled = true;

// Shared promise cache so concurrent mounts of the same model share one load
const pending = new Map<string, Promise<THREE.Group>>();

function loadGroup(
  modelId: string,
  basePath: string,
  glbFile: string,
): Promise<THREE.Group> {
  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  const cacheKey = `${base}${glbFile}`;

  if (pending.has(cacheKey)) {
    return pending.get(cacheKey)!;
  }
  const p = (async () => {
    const loader = new GLTFLoader();
    loader.setPath(base);
    const gltf = await new Promise<
      Awaited<ReturnType<GLTFLoader["loadAsync"]>>
    >((res, rej) => loader.load(glbFile, res, undefined, rej));

    const group = gltf.scene;
    group.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return group;
  })();
  const cached = p.catch((error) => {
    pending.delete(cacheKey);
    throw error;
  });

  pending.set(cacheKey, cached);
  return cached;
}

export interface GLBFurnitureMeshProps {
  modelId: string;
  basePath: string;
  glbFile: string;
  w: number;
  d: number;
  h: number;
  selected?: boolean;
}

export function GLBFurnitureMesh({
  modelId,
  basePath,
  glbFile,
  w,
  d,
  h,
  selected,
}: GLBFurnitureMeshProps) {
  const [group, setGroup] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGroup(null);

    loadGroup(modelId, basePath, glbFile)
      .then((group) => {
        if (!cancelled) {
          setGroup(group.clone(true));
        }
      })
      .catch((error) => {
        console.error("[GLBFurnitureMesh]", error);
      });

    return () => {
      cancelled = true;
    };
  }, [modelId, basePath, glbFile]);

  const normalizedModel = useMemo(() => {
    if (!group) return null;

    group.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(group);
    const sourceSize = bounds.getSize(new THREE.Vector3());
    const sourceCenter = bounds.getCenter(new THREE.Vector3());

    if (
      sourceSize.x <= Number.EPSILON ||
      sourceSize.y <= Number.EPSILON ||
      sourceSize.z <= Number.EPSILON
    ) {
      return null;
    }

    return {
      position: [-sourceCenter.x, -bounds.min.y, -sourceCenter.z] as [
        number,
        number,
        number,
      ],
      scale: [w / sourceSize.x, h / sourceSize.y, d / sourceSize.z] as [
        number,
        number,
        number,
      ],
    };
  }, [group, w, d, h]);

  if (!group || !normalizedModel) return null;

  return (
    <group scale={normalizedModel.scale}>
      <primitive object={group} position={normalizedModel.position} />
    </group>
  );
}
