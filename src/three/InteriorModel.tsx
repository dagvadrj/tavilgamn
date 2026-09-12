"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useThree } from "@react-three/fiber";
import { createModelLoader } from "./modelLoader";

export interface InteriorModelProps {
  /**
   * Base URL for loading files.
   * - Public folder model: "/models/interior-test/"
   * - Database model:      "/api/models/files/{id}/"
   */
  basePath: string;
  glbName: string;
  scale?: number;
  position?: [number, number, number];
  onError?: (msg: string) => void;
  onLoaded?: () => void;
}

export function InteriorModel({
  basePath,
  glbName,
  scale = 1,
  position = [0, 0, 0],
  onError,
  onLoaded,
}: InteriorModelProps) {
  const [obj, setObj] = useState<THREE.Group | null>(null);
  const { gl } = useThree();
  const [failed, setFailed] = useState(false);
  const callbacks = useRef({ onError, onLoaded });
  callbacks.current = { onError, onLoaded };

  const normalizedBase = useMemo(
    () => (basePath.endsWith("/") ? basePath : basePath + "/"),
    [basePath],
  );

  useEffect(() => {
    let cancelled = false;
    let loadedGroup: THREE.Group | null = null;
    const decoder = createModelLoader(gl);
    setFailed(false);
    setObj(null);

    const disposeGroup = (group: THREE.Group) => {
      const resources = new Set<{ dispose: () => void }>();
      group.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        resources.add(node.geometry);
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          resources.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
        }
      });
      resources.forEach(resource => resource.dispose());
    };

    const load = async () => {
      try {
        const isAbsolute = /^(blob:|https?:|data:)/i.test(glbName);
        const loader = decoder.loader;
        if (!isAbsolute) {
          loader.setPath(normalizedBase);
        }
        const gltf = await new Promise<
          Awaited<ReturnType<GLTFLoader["loadAsync"]>>
        >((resolve, reject) => {
          loader.load(glbName, resolve, undefined, (err) => reject(err));
        });

        if (cancelled) { disposeGroup(gltf.scene); return; }

        const group = gltf.scene;
        loadedGroup = group;
        group.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });

        setObj(group);
        callbacks.current.onLoaded?.();
      } catch (e) {
        if (cancelled) return;
        setFailed(true);
        callbacks.current.onError?.(
          e instanceof Error
            ? e.message
            : "Загвар ачаалахад алдаа гарлаа — файл байгаа эсэхийг шалгана уу",
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (loadedGroup) disposeGroup(loadedGroup);
      decoder.draco.dispose(); decoder.ktx.dispose();
    };
  }, [normalizedBase, glbName, gl]);

  if (failed || !obj) return null;

  return <primitive object={obj} position={position} scale={scale} />;
}
